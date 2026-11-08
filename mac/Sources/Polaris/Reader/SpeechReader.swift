// Text-to-speech reader that reports which word is being spoken. Uses the user's ElevenLabs
// voice (through the web app) when one is set, and the Mac's own voices otherwise.
import AVFoundation

@MainActor
final class SpeechReader: NSObject, AVSpeechSynthesizerDelegate, AVAudioPlayerDelegate {
    private let synth = AVSpeechSynthesizer()
    private var text: NSString = ""
    private var words: [NSRange] = []
    private var utterance: AVSpeechUtterance?
    private var utteranceOffset = 0
    private var needsRestart = false
    private(set) var index = 0
    private(set) var isPlaying = false

    // ElevenLabs: the audio for `text`, when each word starts in it, and a timer that follows along.
    private var player: AVAudioPlayer?
    private var wordTimes: [TimeInterval] = []
    private var fetch: Task<Void, Never>?
    private var ticker: Timer?
    /// Set when the web app has no ElevenLabs key, so we stop asking until the voice changes.
    private var elevenLabsUnavailable = false
    /// Set when ElevenLabs failed for the current text, so it keeps using a Mac voice.
    private var macVoiceOnly = false

    // What is actually spoken: `text` with URLs/citations dropped and abbreviations spelled out
    // (see prepare()). Everything on screen still uses `text`; these map its words to the spoken one.
    private var spoken: NSString = ""
    /// Where each of `words` starts in `spoken`, and whether it is skipped (not spoken at all).
    private var spokenStarts: [Int] = []
    private var skipped: [Bool] = []
    /// Whether `spoken` has been prepared for the current text, and the request that does it.
    private var prepared = false
    private var prep: Task<Void, Never>?

    /// Called with the range of the current word, or nil when reading stops.
    var onWord: ((NSRange?) -> Void)?
    var onStateChange: ((Bool) -> Void)?
    /// While getting ready to speak (preparing the text, downloading ElevenLabs audio): called with
    /// the word reading will start from, then with nil once speech starts or is cancelled.
    var onLoading: ((NSRange?) -> Void)?
    private(set) var isLoading = false

    /// Speed multiplier (1.0 = normal) and voice, from the user's reading settings.
    var rate: Float = 1.0 {
        didSet { player?.rate = Self.playerRate(rate) }
    }
    /// An Apple voice identifier (com.apple.…) or an ElevenLabs voice ID.
    var voiceIdentifier: String? {
        didSet { if voiceIdentifier != oldValue { elevenLabsUnavailable = false; dropAudio() } }
    }

    override init() {
        super.init()
        synth.delegate = self
    }

    private var usesElevenLabs: Bool {
        guard let id = voiceIdentifier, Self.isElevenLabsVoice(id) else { return false }
        return !elevenLabsUnavailable && !macVoiceOnly && AccountLink.isConnected
    }

    /// ElevenLabs IDs are short letters and digits; Apple's look like com.apple.voice.compact.en-US.Samantha.
    static func isElevenLabsVoice(_ id: String) -> Bool {
        !id.contains(".") && id.count >= 10 && id.allSatisfy { $0.isASCII && ($0.isLetter || $0.isNumber) }
    }

    /// The word reading is on (or paused on).
    var currentWord: NSRange? { index < words.count ? words[index] : nil }

    /// Moves to the word at character `location` (e.g. the user clicked it); keeps playing if it was.
    func jump(to location: Int, _ current: String) {
        if current as NSString != text { load(current) }
        guard let i = words.firstIndex(where: { NSMaxRange($0) > location }) else { return }
        step(i - index, current)
    }

    func togglePlay(_ current: String) {
        if isPlaying { pause() } else { play(current) }
    }

    func play(_ current: String) {
        if current as NSString != text {
            load(current)
            needsRestart = true
        }
        guard !words.isEmpty else { return }
        if prepared { startPlayback() } else { prepare() }
    }

    private func startPlayback() {
        if usesElevenLabs { playElevenLabs(); return }
        if synth.isPaused && !needsRestart {
            synth.continueSpeaking()
            setLoading(false)
            setPlaying(true)
        } else {
            speak(from: index)
        }
    }

    /// Asks the web app how to say the text aloud, then starts reading. Text with nothing to fix comes
    /// back untouched, and if the app is offline or the request fails we simply read the text as it is.
    private func prepare() {
        guard prep == nil else { return }
        guard AccountLink.isConnected else {
            prepared = true
            startPlayback()
            return
        }
        // Show "playing" while we wait, like the ElevenLabs download.
        setPlaying(true)
        setLoading(true)
        let requested = text
        prep = Task { [weak self] in
            let edits = (try? await PolarisAPI.speechEdits(requested as String)) ?? []
            guard let self, !Task.isCancelled, self.text == requested else { return }
            self.prep = nil
            self.applyEdits(edits)
            self.prepared = true
            self.startPlayback()
        }
    }

    func pause() {
        prep?.cancel()
        prep = nil
        fetch?.cancel()
        fetch = nil
        player?.pause()
        stopTicker()
        synth.pauseSpeaking(at: .word)
        setLoading(false)
        setPlaying(false)
    }

    func stop() {
        prep?.cancel()
        prep = nil
        fetch?.cancel()
        fetch = nil
        player?.stop()
        stopTicker()
        utterance = nil
        synth.stopSpeaking(at: .immediate)
        index = 0
        needsRestart = true
        setLoading(false)
        setPlaying(false)
        onWord?(nil)
    }

    /// Moves by `delta` words; keeps reading from there if already playing.
    func step(_ delta: Int, _ current: String) {
        if current as NSString != text { load(current) }
        guard !words.isEmpty else { return }
        index = max(0, min(words.count - 1, index + delta))
        if let player, index < wordTimes.count {
            player.currentTime = wordTimes[index]
            onWord?(words[index])
        } else if isPlaying && !usesElevenLabs && prepared {
            speak(from: index)
        } else {
            utterance = nil
            synth.stopSpeaking(at: .immediate)
            needsRestart = true
            onWord?(words[index])
        }
    }

    private func load(_ current: String) {
        // Keep our place if the text only grew (the response is still streaming in).
        let grew = current.hasPrefix(text as String)
        text = current as NSString
        words = []
        text.enumerateSubstrings(in: NSRange(location: 0, length: text.length), options: .byWords) { _, r, _, _ in
            self.words.append(r)
        }
        index = grew ? min(index, max(words.count - 1, 0)) : 0
        macVoiceOnly = false
        dropAudio()
        prep?.cancel()
        prep = nil
        prepared = false
        applyEdits([])
    }

    /// Builds the spoken text: `text` with each edit's range replaced, and for every word on screen
    /// where it starts in that spoken text. Words inside an edit all start where the edit does.
    private func applyEdits(_ edits: [SpeechEdit]) {
        var out = ""
        var cursor = 0
        // For each edit: its range in `text`, where its replacement starts in `spoken`,
        // how much longer it makes the text, and whether it is read at all.
        var marks: [(range: NSRange, spokenStart: Int, growth: Int, skipped: Bool)] = []
        for e in edits.sorted(by: { $0.start < $1.start }) {
            guard e.start >= cursor, e.end > e.start, e.end <= text.length else { continue }
            out += text.substring(with: NSRange(location: cursor, length: e.start - cursor))
            let start = (out as NSString).length
            out += e.spoken
            let length = (out as NSString).length - start
            let isSkipped = e.spoken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            marks.append((NSRange(location: e.start, length: e.end - e.start), start, length - (e.end - e.start), isSkipped))
            cursor = e.end
        }
        out += text.substring(from: cursor)
        spoken = out as NSString

        // Words are in order, so each mark is passed once.
        var m = 0
        var shift = 0 // how much longer (or shorter) `spoken` is than `text` before this word
        spokenStarts = []
        skipped = []
        for w in words {
            while m < marks.count, NSMaxRange(marks[m].range) <= w.location {
                shift += marks[m].growth
                m += 1
            }
            if m < marks.count, marks[m].range.location <= w.location {
                spokenStarts.append(marks[m].spokenStart)
                skipped.append(marks[m].skipped)
            } else {
                spokenStarts.append(w.location + shift)
                skipped.append(false)
            }
        }
    }

    // MARK: - Mac voices

    private func speak(from i: Int) {
        utterance = nil
        synth.stopSpeaking(at: .immediate)
        guard i < words.count else { return }
        index = i
        utteranceOffset = spokenStarts[i]
        let rest = spoken.substring(from: utteranceOffset)
        guard !rest.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { finished(); return }
        let u = AVSpeechUtterance(string: rest)
        u.rate = min(AVSpeechUtteranceMaximumSpeechRate,
                     max(AVSpeechUtteranceMinimumSpeechRate, AVSpeechUtteranceDefaultSpeechRate * rate))
        if let id = voiceIdentifier { u.voice = Self.voice(id) }
        utterance = u
        needsRestart = false
        synth.speak(u)
        setLoading(false)
        setPlaying(true)
        onWord?(words[i])
    }

    /// The voice with this identifier, or one with the same name (the web's list says
    /// "compact" but a Mac may have the "super-compact" or "premium" version). nil = system voice.
    private static func voice(_ id: String) -> AVSpeechSynthesisVoice? {
        if let exact = AVSpeechSynthesisVoice(identifier: id) { return exact }
        guard id.contains("."), let name = id.split(separator: ".").last.map(String.init) else { return nil }
        return AVSpeechSynthesisVoice.speechVoices().first { $0.name == name }
    }

    // MARK: - ElevenLabs

    private func playElevenLabs() {
        utterance = nil
        synth.stopSpeaking(at: .immediate)
        if let player {
            if needsRestart, index < wordTimes.count { player.currentTime = wordTimes[index] }
            needsRestart = false
            player.play()
            startTicker()
            setLoading(false)
            setPlaying(true)
            onWord?(words[index])
            return
        }
        guard fetch == nil, let voice = voiceIdentifier else { return }
        // Show "playing" while the audio downloads; the first word lights up when it starts.
        setPlaying(true)
        setLoading(true)
        let requested = text
        let toSpeak = spoken as String
        fetch = Task { [weak self] in
            do {
                let speech = try await PolarisAPI.speak(toSpeak, voiceId: voice)
                guard let self, !Task.isCancelled, self.text == requested else { return }
                self.fetch = nil
                try self.startAudio(speech)
            } catch {
                guard let self, !Task.isCancelled, self.text == requested else { return }
                self.fetch = nil
                print("ElevenLabs unavailable, using a Mac voice: \(error.localizedDescription)")
                if case PolarisAPI.APIError.unavailable = error { self.elevenLabsUnavailable = true }
                self.macVoiceOnly = true
                // Read this text with a Mac voice instead.
                self.speak(from: self.index)
            }
        }
    }

    private func startAudio(_ speech: Speech) throws {
        guard let data = Data(base64Encoded: speech.audio) else { throw PolarisAPI.APIError.server("Bad audio") }
        let player = try AVAudioPlayer(data: data)
        player.delegate = self
        player.enableRate = true
        player.rate = Self.playerRate(rate)
        player.prepareToPlay()
        self.player = player
        wordTimes = Self.times(forSpokenStarts: spokenStarts, from: speech.charTimes,
                               textLength: spoken.length, duration: player.duration)
        needsRestart = false
        if index < wordTimes.count { player.currentTime = wordTimes[index] }
        player.play()
        startTicker()
        setLoading(false)
        onWord?(words[index])
    }

    /// Start time for each of our words, given where it starts in the spoken text. Never goes
    /// backwards, so the highlight can't jump back to an earlier word.
    /// Without timings from the server, spreads the words evenly over the audio.
    private static func times(forSpokenStarts starts: [Int], from charTimes: [Double],
                              textLength: Int, duration: TimeInterval) -> [TimeInterval] {
        guard !charTimes.isEmpty else {
            return starts.map { duration * Double($0) / Double(max(1, textLength)) }
        }
        var latest: TimeInterval = 0
        return starts.map { start in
            latest = max(latest, charTimes[max(0, min(start, charTimes.count - 1))])
            return latest
        }
    }

    private static func playerRate(_ rate: Float) -> Float { min(2, max(0.5, rate)) }

    private func startTicker() {
        stopTicker()
        let timer = Timer(timeInterval: 0.05, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
        RunLoop.main.add(timer, forMode: .common)
        ticker = timer
    }

    private func stopTicker() {
        ticker?.invalidate()
        ticker = nil
    }

    /// Highlights the word the audio has reached.
    private func tick() {
        guard let player, player.isPlaying, !wordTimes.isEmpty else { return }
        let t = player.currentTime
        var i = index
        while i + 1 < wordTimes.count && wordTimes[i + 1] <= t { i += 1 }
        while i > 0 && wordTimes[i] > t { i -= 1 }
        if i != index {
            index = i
            onWord?(words[i])
        }
    }

    private func dropAudio() {
        fetch?.cancel()
        fetch = nil
        player?.stop()
        player = nil
        wordTimes = []
        stopTicker()
    }

    // MARK: - Shared

    private func setLoading(_ loading: Bool) {
        guard loading != isLoading else { return }
        isLoading = loading
        onLoading?(loading && index < words.count ? words[index] : nil)
    }

    private func setPlaying(_ playing: Bool) {
        guard playing != isPlaying else { return }
        isPlaying = playing
        onStateChange?(playing)
    }

    private func spoke(_ range: NSRange, in u: AVSpeechUtterance) {
        guard u === utterance else { return }
        let loc = range.location + utteranceOffset // in `spoken`
        // The last word that starts at or before it, moved back to the first word of an edit
        // that spans several (so "$1.2M" lights up as one while "1.2 million dollars" is said).
        guard let last = words.indices.last(where: { !skipped[$0] && spokenStarts[$0] <= loc }) else { return }
        let i = words.indices.first { !skipped[$0] && spokenStarts[$0] == spokenStarts[last] } ?? last
        index = i
        onWord?(words[i])
    }

    private func finished() {
        utterance = nil
        stopTicker()
        index = 0
        needsRestart = true
        setLoading(false)
        setPlaying(false)
        onWord?(nil)
    }

    nonisolated func speechSynthesizer(_ s: AVSpeechSynthesizer, willSpeakRangeOfSpeechString range: NSRange,
                                       utterance u: AVSpeechUtterance) {
        Task { @MainActor in self.spoke(range, in: u) }
    }

    nonisolated func speechSynthesizer(_ s: AVSpeechSynthesizer, didFinish u: AVSpeechUtterance) {
        Task { @MainActor in if u === self.utterance { self.finished() } }
    }

    nonisolated func audioPlayerDidFinishPlaying(_ p: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in if p === self.player { self.finished() } }
    }
}
