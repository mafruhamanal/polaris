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

    /// Called with the range of the current word, or nil when reading stops.
    var onWord: ((NSRange?) -> Void)?
    var onStateChange: ((Bool) -> Void)?

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

    func togglePlay(_ current: String) {
        if isPlaying { pause() } else { play(current) }
    }

    func play(_ current: String) {
        if current as NSString != text {
            load(current)
            needsRestart = true
        }
        guard !words.isEmpty else { return }
        if usesElevenLabs { playElevenLabs(); return }
        if synth.isPaused && !needsRestart {
            synth.continueSpeaking()
            setPlaying(true)
        } else {
            speak(from: index)
        }
    }

    func pause() {
        fetch?.cancel()
        fetch = nil
        player?.pause()
        stopTicker()
        synth.pauseSpeaking(at: .word)
        setPlaying(false)
    }

    func stop() {
        fetch?.cancel()
        fetch = nil
        player?.stop()
        stopTicker()
        utterance = nil
        synth.stopSpeaking(at: .immediate)
        index = 0
        needsRestart = true
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
        } else if isPlaying && !usesElevenLabs {
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
    }

    // MARK: - Mac voices

    private func speak(from i: Int) {
        utterance = nil
        synth.stopSpeaking(at: .immediate)
        guard i < words.count else { return }
        index = i
        utteranceOffset = words[i].location
        let u = AVSpeechUtterance(string: text.substring(from: utteranceOffset))
        u.rate = min(AVSpeechUtteranceMaximumSpeechRate,
                     max(AVSpeechUtteranceMinimumSpeechRate, AVSpeechUtteranceDefaultSpeechRate * rate))
        if let id = voiceIdentifier { u.voice = Self.voice(id) }
        utterance = u
        needsRestart = false
        synth.speak(u)
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
            setPlaying(true)
            onWord?(words[index])
            return
        }
        guard fetch == nil, let voice = voiceIdentifier else { return }
        // Show "playing" while the audio downloads; the first word lights up when it starts.
        setPlaying(true)
        let requested = text
        fetch = Task { [weak self] in
            do {
                let speech = try await PolarisAPI.speak(requested as String, voiceId: voice)
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
        wordTimes = Self.times(for: words, from: speech.words)
        needsRestart = false
        if index < wordTimes.count { player.currentTime = wordTimes[index] }
        player.play()
        startTicker()
        onWord?(words[index])
    }

    /// Start time for each of our words: the time of the last server word starting at or before it.
    private static func times(for words: [NSRange], from timed: [Speech.Word]) -> [TimeInterval] {
        var j = 0
        return words.map { w in
            while j + 1 < timed.count && timed[j + 1].offset <= w.location { j += 1 }
            return timed.isEmpty ? 0 : timed[j].time
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

    private func setPlaying(_ playing: Bool) {
        guard playing != isPlaying else { return }
        isPlaying = playing
        onStateChange?(playing)
    }

    private func spoke(_ range: NSRange, in u: AVSpeechUtterance) {
        guard u === utterance else { return }
        let loc = range.location + utteranceOffset
        if let i = words.firstIndex(where: { NSMaxRange($0) > loc }) {
            index = i
            onWord?(words[i])
        }
    }

    private func finished() {
        utterance = nil
        stopTicker()
        index = 0
        needsRestart = true
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
