// Word help: while read-aloud is paused, a small card above the word it stopped on with the word
// split into syllables (worked out on this Mac), a button to hear it said slowly, and a short
// meaning that fits the sentence it's in (from the web app).
import AppKit
import AVFoundation

@MainActor
final class WordHelp: NSObject, NSPopoverDelegate {
    private let popover = NSPopover()
    private let synth = AVSpeechSynthesizer()
    private var task: Task<Void, Never>?
    private var word = ""
    private let stack = NSStackView()
    private let wordLabel = NSTextField(labelWithString: "")
    private let syllablesLabel = NSTextField(labelWithString: "")
    private let meaningLabel = NSTextField(wrappingLabelWithString: "")
    private var sayButton: NSButton?
    private let width: CGFloat = 300

    private var settings: ReaderSettings { SettingsStore.shared.settings }

    override init() {
        super.init()
        popover.behavior = .transient
        popover.animates = true
        popover.delegate = self

        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 8
        stack.edgeInsets = NSEdgeInsets(top: 14, left: 16, bottom: 16, right: 16)
        meaningLabel.preferredMaxLayoutWidth = width - 32

        let controller = NSViewController()
        controller.view = stack
        popover.contentViewController = controller
    }

    var isShown: Bool { popover.isShown }

    /// Opens the card for `word` (from `sentence`) pointing at `rect` in `view`.
    func show(word: String, sentence: String, relativeTo rect: NSRect, of view: NSView) {
        close()
        self.word = word
        let s = settings
        let bold = NSFontManager.shared.convert(s.font, toHaveTrait: .boldFontMask)
        wordLabel.font = NSFont(descriptor: bold.fontDescriptor, size: min(34, max(20, CGFloat(s.fontSize) * 1.4))) ?? bold
        wordLabel.textColor = s.textColor
        wordLabel.stringValue = word

        let parts = Self.syllables(word)
        syllablesLabel.font = NSFont(descriptor: s.font.fontDescriptor, size: max(15, CGFloat(s.fontSize))) ?? s.font
        syllablesLabel.textColor = .controlAccentColor
        syllablesLabel.stringValue = parts.joined(separator: " · ")
        syllablesLabel.toolTip = parts.count == 1 ? "One syllable" : "\(parts.count) syllables"

        meaningLabel.font = NSFont(descriptor: s.font.fontDescriptor, size: max(14, CGFloat(s.fontSize) * 0.9)) ?? s.font
        meaningLabel.textColor = s.textColor.withAlphaComponent(0.6)
        meaningLabel.stringValue = "Looking up what it means here…"

        sayButton?.removeFromSuperview()
        let say = Chip.make("Say it slowly", symbol: "tortoise.fill", settings: s, target: self, action: #selector(sayTapped))
        sayButton = say
        stack.setViews([wordLabel, syllablesLabel, say, meaningLabel], in: .leading)
        stack.setCustomSpacing(2, after: wordLabel)
        stack.setCustomSpacing(12, after: say)
        say.heightAnchor.constraint(equalToConstant: Chip.height(s)).isActive = true
        say.widthAnchor.constraint(equalToConstant: Chip.width(say)).isActive = true

        popover.appearance = s.appearance
        resize()
        popover.show(relativeTo: rect, of: view, preferredEdge: view.isFlipped ? .minY : .maxY)

        task = Task { [weak self] in
            do {
                let meaning = try await PolarisAPI.define(word, sentence: sentence)
                guard let self, !Task.isCancelled else { return }
                self.meaningLabel.textColor = self.settings.textColor
                self.meaningLabel.stringValue = meaning
            } catch {
                guard let self, !Task.isCancelled else { return }
                self.meaningLabel.stringValue = "Couldn't get the meaning: \(error.localizedDescription)"
            }
            self?.resize()
        }
    }

    func close() {
        task?.cancel()
        task = nil
        synth.stopSpeaking(at: .immediate)
        if popover.isShown { popover.performClose(nil) }
    }

    func popoverDidClose(_ notification: Notification) {
        task?.cancel()
        synth.stopSpeaking(at: .immediate)
    }

    private func resize() {
        stack.layoutSubtreeIfNeeded()
        let height = stack.fittingSize.height
        popover.contentSize = NSSize(width: width, height: max(120, height))
    }

    /// Says the word slowly with the Mac's voice (the user's, if it's a Mac voice).
    @objc private func sayTapped() {
        synth.stopSpeaking(at: .immediate)
        let u = AVSpeechUtterance(string: word)
        u.rate = AVSpeechUtteranceDefaultSpeechRate * 0.6
        if let id = settings.voice, let voice = AVSpeechSynthesisVoice(identifier: id) { u.voice = voice }
        synth.speak(u)
    }

    /// The word split where it can be hyphenated, which is close to its syllables
    /// ("photosynthesis" → pho, to, syn, the, sis). Short words stay whole.
    static func syllables(_ word: String) -> [String] {
        let locale = Locale(identifier: "en_US") as CFLocale
        let cf = word as CFString
        let length = CFStringGetLength(cf)
        guard CFStringIsHyphenationAvailableForLocale(locale), length > 3 else { return [word] }
        var breaks: [Int] = []
        var before = length
        while before > 0 {
            let at = CFStringGetHyphenationLocationBeforeIndex(cf, before, CFRange(location: 0, length: length), 0, locale, nil)
            if at == kCFNotFound || at <= 0 || at >= before { break }
            breaks.insert(at, at: 0)
            before = at
        }
        let ns = word as NSString
        var parts: [String] = []
        var start = 0
        for b in breaks + [length] where b > start {
            parts.append(ns.substring(with: NSRange(location: start, length: b - start)))
            start = b
        }
        // Hyphenation points aren't always syllables ("chloroplas-ts"): a piece with no vowel joins
        // the one before it.
        let vowels = CharacterSet(charactersIn: "aeiouyAEIOUY")
        var merged: [String] = []
        for part in parts {
            if !merged.isEmpty, part.rangeOfCharacter(from: vowels) == nil {
                merged[merged.count - 1] += part
            } else {
                merged.append(part)
            }
        }
        return merged.isEmpty ? [word] : merged
    }
}
