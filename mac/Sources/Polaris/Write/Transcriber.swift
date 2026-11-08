// Live speech-to-text for Write, using Apple's on-device speech recognition.
import AVFoundation
import Speech

@MainActor
final class Transcriber {
    enum Problem: LocalizedError {
        case needsAppBundle, microphoneDenied, speechDenied, unavailable

        var errorDescription: String? {
            switch self {
            case .needsAppBundle:
                return "Write needs the Polaris app (mac/scripts/build-app.sh --open), not swift run, so macOS can ask for the microphone."
            case .microphoneDenied:
                return "Polaris can't use the microphone. Turn it on in System Settings → Privacy & Security → Microphone."
            case .speechDenied:
                return "Polaris can't use speech recognition. Turn it on in System Settings → Privacy & Security → Speech Recognition."
            case .unavailable:
                return "Speech recognition isn't available right now. Check your language in System Settings → Keyboard → Dictation."
            }
        }
    }

    /// Called with everything said so far, as it changes.
    var onText: ((String) -> Void)?
    /// Microphone loudness, 0 to 1.
    var onLevel: ((Float) -> Void)?

    private(set) var isRecording = false
    var transcript: String { Self.join(committed, partial) }

    private let engine = AVAudioEngine()
    private let recognizer = SFSpeechRecognizer() ?? SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private let sink = AudioSink()
    private var task: SFSpeechRecognitionTask?
    private var segment = 0
    /// Text from finished segments, and the segment still being recognized.
    private var committed = ""
    private var partial = ""

    /// Forgets what was said.
    func reset() {
        stop()
        committed = ""
        partial = ""
    }

    /// Starts (or resumes) listening; what's already been said is kept.
    func start() async throws {
        guard !isRecording else { return }
        // Without usage descriptions in Info.plist, macOS ends the app when we ask for permission.
        guard Bundle.main.object(forInfoDictionaryKey: "NSSpeechRecognitionUsageDescription") != nil,
              Bundle.main.object(forInfoDictionaryKey: "NSMicrophoneUsageDescription") != nil else {
            throw Problem.needsAppBundle
        }
        guard await Self.speechAllowed() else { throw Problem.speechDenied }
        guard await AVCaptureDevice.requestAccess(for: .audio) else { throw Problem.microphoneDenied }
        guard let recognizer, recognizer.isAvailable else { throw Problem.unavailable }

        beginSegment(recognizer)
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { [sink, weak self] buffer, _ in
            sink.append(buffer)
            let level = Self.level(buffer)
            DispatchQueue.main.async { self?.onLevel?(level) }
        }
        engine.prepare()
        do {
            try engine.start()
        } catch {
            input.removeTap(onBus: 0)
            endSegment()
            throw error
        }
        isRecording = true
    }

    /// Stops listening (keeps the transcript, so start() continues it).
    func stop() {
        guard isRecording else { return }
        isRecording = false
        engine.stop()
        engine.inputNode.removeTap(onBus: 0)
        endSegment()
        onLevel?(0)
    }

    // MARK: - Segments

    /// The recognizer finishes a request after a long pause, so we start a new one and keep going.
    private func beginSegment(_ recognizer: SFSpeechRecognizer) {
        segment += 1
        let id = segment
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.addsPunctuation = true
        if recognizer.supportsOnDeviceRecognition { request.requiresOnDeviceRecognition = true }
        sink.set(request)
        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            let text = result?.bestTranscription.formattedString
            let final = result?.isFinal ?? false
            Task { @MainActor in self?.handle(text: text, final: final || error != nil, segment: id) }
        }
    }

    private func endSegment() {
        sink.set(nil)
        task?.cancel()
        task = nil
        segment += 1
        commit()
    }

    private func handle(text: String?, final: Bool, segment id: Int) {
        guard id == segment else { return }
        if let text { partial = text }
        onText?(transcript)
        if final {
            commit()
            task = nil
            if isRecording, let recognizer { beginSegment(recognizer) }
        }
    }

    private func commit() {
        committed = Self.join(committed, partial)
        partial = ""
    }

    private static func join(_ a: String, _ b: String) -> String {
        [a, b].map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }.joined(separator: " ")
    }

    // MARK: - Helpers

    private static func speechAllowed() async -> Bool {
        switch SFSpeechRecognizer.authorizationStatus() {
        case .authorized: return true
        case .notDetermined:
            return await withCheckedContinuation { done in
                SFSpeechRecognizer.requestAuthorization { done.resume(returning: $0 == .authorized) }
            }
        default: return false
        }
    }

    /// Loudness of a buffer from 0 (silence) to 1 (loud).
    nonisolated private static func level(_ buffer: AVAudioPCMBuffer) -> Float {
        guard let samples = buffer.floatChannelData?[0], buffer.frameLength > 0 else { return 0 }
        var sum: Float = 0
        for i in 0..<Int(buffer.frameLength) { sum += samples[i] * samples[i] }
        let rms = (sum / Float(buffer.frameLength)).squareRoot()
        let db = 20 * log10(max(rms, 0.000_01))
        return min(1, max(0, (db + 50) / 45))
    }
}

/// Hands microphone buffers (from the audio thread) to the current recognition request.
private final class AudioSink: @unchecked Sendable {
    private let lock = NSLock()
    private var request: SFSpeechAudioBufferRecognitionRequest?

    func set(_ r: SFSpeechAudioBufferRecognitionRequest?) {
        lock.lock()
        request?.endAudio()
        request = r
        lock.unlock()
    }

    func append(_ buffer: AVAudioPCMBuffer) {
        lock.lock()
        request?.append(buffer)
        lock.unlock()
    }
}
