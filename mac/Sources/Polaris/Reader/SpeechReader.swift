// Text-to-speech reader that reports which word is being spoken.
import AVFoundation

@MainActor
final class SpeechReader: NSObject, AVSpeechSynthesizerDelegate {
    private let synth = AVSpeechSynthesizer()
    private var text: NSString = ""
    private var words: [NSRange] = []
    private var utterance: AVSpeechUtterance?
    private var utteranceOffset = 0
    private var needsRestart = false
    private(set) var index = 0
    private(set) var isPlaying = false

    /// Called with the range of the current word, or nil when reading stops.
    var onWord: ((NSRange?) -> Void)?
    var onStateChange: ((Bool) -> Void)?

    /// Speed multiplier (1.0 = normal) and voice, from the user's reading settings.
    var rate: Float = 1.0
    var voiceIdentifier: String?

    override init() {
        super.init()
        synth.delegate = self
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
        if synth.isPaused && !needsRestart {
            synth.continueSpeaking()
            setPlaying(true)
        } else {
            speak(from: index)
        }
    }

    func pause() {
        synth.pauseSpeaking(at: .word)
        setPlaying(false)
    }

    func stop() {
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
        if isPlaying {
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
    }

    private func speak(from i: Int) {
        utterance = nil
        synth.stopSpeaking(at: .immediate)
        guard i < words.count else { return }
        index = i
        utteranceOffset = words[i].location
        let u = AVSpeechUtterance(string: text.substring(from: utteranceOffset))
        u.rate = min(AVSpeechUtteranceMaximumSpeechRate,
                     max(AVSpeechUtteranceMinimumSpeechRate, AVSpeechUtteranceDefaultSpeechRate * rate))
        if let id = voiceIdentifier { u.voice = AVSpeechSynthesisVoice(identifier: id) }
        utterance = u
        needsRestart = false
        synth.speak(u)
        setPlaying(true)
        onWord?(words[i])
    }

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

    private func finished(_ u: AVSpeechUtterance) {
        guard u === utterance else { return }
        utterance = nil
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
        Task { @MainActor in self.finished(u) }
    }
}
