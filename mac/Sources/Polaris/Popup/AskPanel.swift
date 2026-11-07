// Ask view in the popup: question box, suggestion chips, and the answer with the sentences it came from.
import AppKit

@MainActor
final class AskPanel: NSView {
    static let starters = ["What does this mean?", "Explain the hard words", "Sum it up in one sentence"]

    /// Called with the question when the user presses Return, clicks send, or taps a chip.
    var onAsk: ((String) -> Void)?

    let field = NSTextField()
    private let sendButton = FirstClickButton()
    private let chips = NSView()
    private let scroll = NSScrollView()
    private let textView = NSTextView()
    private let speakButton = FirstClickButton()
    private let reader = SpeechReader()
    private let highlighter: WordHighlighter
    private var suggestions: [String] = []
    private var answer = ""

    override init(frame: NSRect) {
        highlighter = WordHighlighter(textView: textView)
        super.init(frame: frame)

        field.placeholderString = "Ask about this…"
        field.font = .systemFont(ofSize: 14)
        field.bezelStyle = .roundedBezel
        field.focusRingType = .none
        field.target = self
        field.action = #selector(submit)

        sendButton.image = NSImage(systemSymbolName: "arrow.up.circle.fill", accessibilityDescription: "Ask")?
            .withSymbolConfiguration(.init(pointSize: 20, weight: .regular))
        sendButton.isBordered = false
        sendButton.toolTip = "Ask (Return)"
        sendButton.target = self
        sendButton.action = #selector(submit)

        scroll.hasVerticalScroller = true
        scroll.drawsBackground = false
        textView.isEditable = false
        textView.isSelectable = true
        textView.drawsBackground = false
        textView.textContainerInset = NSSize(width: 4, height: 4)
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.autoresizingMask = [.width]
        textView.textContainer?.widthTracksTextView = true
        textView.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: .greatestFiniteMagnitude)
        scroll.documentView = textView

        speakButton.isBordered = false
        speakButton.target = self
        speakButton.action = #selector(speak)
        setSpeaking(false)

        for v in [field, sendButton, chips, scroll, speakButton] as [NSView] { addSubview(v) }

        reader.onWord = { [weak self] range in self?.highlighter.highlight(range) }
        reader.onStateChange = { [weak self] playing in self?.setSpeaking(playing) }
    }

    required init?(coder: NSCoder) { fatalError() }

    // MARK: - States

    /// Fresh Ask view: empty box, starter chips.
    func reset() {
        stop()
        field.stringValue = ""
        field.isEnabled = true
        answer = ""
        setBody(NSAttributedString())
        setSuggestions(Self.starters)
        speakButton.isHidden = true
        sendButton.contentTintColor = SettingsStore.shared.settings.textColor
    }

    func showLoading() {
        stop()
        field.isEnabled = false
        answer = ""
        setBody(note("Thinking…"))
        setSuggestions([])
        speakButton.isHidden = true
    }

    func showError(_ message: String) {
        field.isEnabled = true
        answer = ""
        setBody(SettingsStore.shared.settings.styled("⚠️ " + message))
        setSuggestions(suggestions.isEmpty ? Self.starters : suggestions)
        speakButton.isHidden = true
    }

    func show(_ result: AskResult, context: SelectionContext) {
        field.isEnabled = true
        field.stringValue = ""
        let settings = SettingsStore.shared.settings
        answer = result.answer.isEmpty ? "I can only help with what you selected." : result.answer

        // The answer comes first, so the reader's word ranges line up with the text view.
        let body = NSMutableAttributedString(attributedString: settings.styled(answer))
        if result.inScope && !result.fromText {
            body.append(note("\n\nNot in the text — general explanation."))
        }
        if result.inScope && !result.evidence.isEmpty {
            body.append(note("\n\nFrom the text:\n"))
            body.append(passage(highlighting: result.evidence, in: context))
        }
        setBody(body)
        setSuggestions(result.suggestions.isEmpty ? Self.starters : result.suggestions)
        setSpeaking(false)
        speakButton.isHidden = false
    }

    func stop() { reader.stop() }

    // MARK: - Pieces

    /// The selection with each evidence quote highlighted. Long selections show just the quotes.
    private func passage(highlighting quotes: [String], in context: SelectionContext) -> NSAttributedString {
        let settings = SettingsStore.shared.settings
        let selection = context.selection.trimmingCharacters(in: .whitespacesAndNewlines)
        let showSelection = selection.count <= 1200
        let extra = quotes.filter { !showSelection || (selection as NSString).range(of: $0, options: .caseInsensitive).location == NSNotFound }

        let text = ([showSelection ? selection : nil] + extra.map { "“\($0)”" }).compactMap { $0 }.joined(separator: "\n\n")
        let result = NSMutableAttributedString(attributedString: settings.styled(text))
        let ns = text as NSString
        let mark = NSColor.systemYellow.withAlphaComponent(0.35)
        for q in quotes {
            var search = NSRange(location: 0, length: ns.length)
            while true {
                let r = ns.range(of: q, options: .caseInsensitive, range: search)
                if r.location == NSNotFound { break }
                result.addAttribute(.backgroundColor, value: mark, range: r)
                search = NSRange(location: NSMaxRange(r), length: ns.length - NSMaxRange(r))
            }
        }
        return result
    }

    /// Small secondary text for labels like "From the text:".
    private func note(_ s: String) -> NSAttributedString {
        let settings = SettingsStore.shared.settings
        return NSAttributedString(string: s, attributes: [
            .font: NSFont.systemFont(ofSize: 12, weight: .semibold),
            .foregroundColor: settings.textColor.withAlphaComponent(0.6),
        ])
    }

    private func setBody(_ s: NSAttributedString) {
        textView.textStorage?.setAttributedString(s)
        textView.scrollToBeginningOfDocument(nil)
    }

    private func setSuggestions(_ list: [String]) {
        suggestions = list
        chips.subviews.forEach { $0.removeFromSuperview() }
        let color = SettingsStore.shared.settings.textColor
        for title in list {
            let chip = FirstClickButton(title: title, target: self, action: #selector(chipTapped(_:)))
            chip.isBordered = false
            chip.attributedTitle = NSAttributedString(string: title, attributes: [
                .font: NSFont.systemFont(ofSize: 12), .foregroundColor: color,
            ])
            chip.wantsLayer = true
            chip.layer?.cornerRadius = 11
            chip.layer?.borderWidth = 1
            chip.layer?.borderColor = color.withAlphaComponent(0.25).cgColor
            chip.layer?.backgroundColor = color.withAlphaComponent(0.06).cgColor
            chips.addSubview(chip)
        }
        needsLayout = true
        layoutSubtreeIfNeeded()
    }

    private func setSpeaking(_ playing: Bool) {
        let name = playing ? "pause.fill" : "speaker.wave.2.fill"
        speakButton.image = NSImage(systemSymbolName: name, accessibilityDescription: playing ? "Pause" : "Read answer aloud")
        speakButton.toolTip = playing ? "Pause" : "Read the answer aloud"
        speakButton.contentTintColor = SettingsStore.shared.settings.textColor
    }

    // MARK: - Actions

    @objc private func submit() {
        let q = field.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty, field.isEnabled else { return }
        onAsk?(q)
    }

    @objc private func chipTapped(_ sender: NSButton) {
        guard field.isEnabled else { return }
        field.stringValue = sender.title
        submit()
    }

    @objc private func speak() {
        guard !answer.isEmpty else { return }
        let settings = SettingsStore.shared.settings
        reader.rate = Float(settings.readingSpeed)
        reader.voiceIdentifier = settings.voice
        reader.togglePlay(answer)
    }

    // MARK: - Layout (frames by hand, like the rest of the popup)

    override func layout() {
        super.layout()
        let w = bounds.width, pad: CGFloat = 12, row: CGFloat = 28
        var top = bounds.height - pad

        top -= row
        field.frame = NSRect(x: pad, y: top, width: w - pad * 2 - 32, height: row)
        sendButton.frame = NSRect(x: w - pad - 28, y: top, width: 28, height: row)

        // Chips flow left to right and wrap.
        var x: CGFloat = 0, lineY: CGFloat = 0, lineHeight: CGFloat = 22
        let maxWidth = w - pad * 2
        var frames: [NSRect] = []
        for chip in chips.subviews {
            let size = NSSize(width: min(chip.fittingSize.width + 20, maxWidth), height: lineHeight)
            if x > 0 && x + size.width > maxWidth { x = 0; lineY += lineHeight + 6 }
            frames.append(NSRect(origin: NSPoint(x: x, y: lineY), size: size))
            x += size.width + 6
        }
        let chipsHeight = chips.subviews.isEmpty ? 0 : lineY + lineHeight
        top -= chipsHeight == 0 ? 0 : 8 + chipsHeight
        chips.frame = NSRect(x: pad, y: top, width: maxWidth, height: chipsHeight)
        // Flip so the first line is on top.
        for (chip, f) in zip(chips.subviews, frames) {
            chip.frame = NSRect(x: f.minX, y: chipsHeight - f.maxY, width: f.width, height: f.height)
        }

        let bottomBar: CGFloat = 36
        top -= 8
        scroll.frame = NSRect(x: pad - 4, y: bottomBar, width: w - pad * 2 + 8, height: max(0, top - bottomBar))
        speakButton.frame = NSRect(x: w - pad - 32, y: 4, width: 32, height: 28)
    }
}
