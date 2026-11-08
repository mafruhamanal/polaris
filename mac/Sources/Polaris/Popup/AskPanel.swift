// Ask view in the popup: a conversation about the selection. Question box, suggestion chips,
// and each answer with the sentences it came from, all in the user's reading settings.
import AppKit

@MainActor
final class AskPanel: NSView {
    static let starters = ["What does this mean?", "Explain the hard words", "Sum it up in one sentence"]

    /// Called with the question when the user presses Return, clicks send, or taps a chip.
    var onAsk: ((String) -> Void)?

    /// Earlier questions and answers, sent with each new question so follow-ups make sense.
    var history: [(question: String, answer: String)] {
        turns.map { ($0.question, $0.result.answer) }
    }

    let field = NSTextField()
    private let sendButton = FirstClickButton()
    private let chips = NSView()
    private let scroll = NSScrollView()
    private let textView = NSTextView()
    private let speakButton = FirstClickButton()
    private let reader = SpeechReader()
    private let highlighter: WordHighlighter
    private var turns: [(question: String, result: AskResult)] = []
    private var context: SelectionContext?
    private var suggestions: [String] = []
    /// Where the latest answer sits in the text view, so read-aloud highlights the right words.
    private var answerRange = NSRange(location: 0, length: 0)

    private var settings: ReaderSettings { SettingsStore.shared.settings }

    override init(frame: NSRect) {
        highlighter = WordHighlighter(textView: textView)
        super.init(frame: frame)

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

        for v in [field, sendButton, chips, scroll, speakButton] as [NSView] { addSubview(v) }

        // The reader works on the answer alone; shift its word ranges to where the answer sits.
        reader.onWord = { [weak self] range in
            guard let self else { return }
            self.highlighter.highlight(range.map {
                NSRange(location: $0.location + self.answerRange.location, length: $0.length)
            })
        }
        reader.onStateChange = { [weak self] playing in self?.setSpeaking(playing) }
    }

    required init?(coder: NSCoder) { fatalError() }

    // MARK: - States

    /// A new conversation about `context`: empty box, starter chips.
    func reset(context: SelectionContext?) {
        stop()
        self.context = context
        turns = []
        applySettings()
        field.stringValue = ""
        field.isEnabled = true
        render()
        setSuggestions(Self.starters)
    }

    /// Shows the question under the earlier turns with "Thinking…".
    func showLoading(_ question: String) {
        stop()
        field.isEnabled = false
        field.stringValue = ""
        render(pending: question, status: "Thinking…")
        setSuggestions([])
    }

    func showError(_ message: String, question: String? = nil) {
        field.isEnabled = true
        if let question { field.stringValue = question }
        render(pending: question, status: "⚠️ " + message)
        setSuggestions(suggestions.isEmpty ? Self.starters : suggestions)
        focusField()
    }

    func show(_ result: AskResult, for question: String) {
        turns.append((question, result))
        field.isEnabled = true
        render()
        setSuggestions(result.suggestions.isEmpty ? Self.starters : result.suggestions)
        focusField()
    }

    func stop() { reader.stop() }

    // MARK: - Rendering

    /// Draws the whole conversation, plus an optional unanswered question with a status line.
    private func render(pending: String? = nil, status: String? = nil) {
        let body = NSMutableAttributedString()
        var lastTurnStart = 0
        answerRange = NSRange(location: 0, length: 0)

        for (i, turn) in turns.enumerated() {
            if i > 0 { body.append(gap()) }
            lastTurnStart = body.length
            body.append(label("You asked: " + turn.question + "\n"))
            let answer = Self.answerText(turn.result)
            answerRange = NSRange(location: body.length, length: (answer as NSString).length)
            body.append(settings.styled(answer))
            if turn.result.inScope && !turn.result.fromText {
                body.append(label("\nNot in the text — general explanation."))
            }
            if turn.result.inScope && !turn.result.evidence.isEmpty, let context {
                body.append(label("\nFrom the text:\n"))
                body.append(passage(highlighting: turn.result.evidence, in: context))
            }
        }
        if let pending {
            if !turns.isEmpty { body.append(gap()) }
            lastTurnStart = body.length
            body.append(label("You asked: " + pending + "\n"))
        }
        if let status {
            body.append(settings.styled(status))
        }

        textView.textStorage?.setAttributedString(body)
        speakButton.isHidden = turns.isEmpty || pending != nil
        setSpeaking(false)
        // Show the newest question at the top of the view.
        if let lm = textView.layoutManager, let tc = textView.textContainer {
            lm.ensureLayout(for: tc)
            let glyphs = lm.glyphRange(forCharacterRange: NSRange(location: lastTurnStart, length: 0), actualCharacterRange: nil)
            let rect = lm.boundingRect(forGlyphRange: glyphs, in: tc)
            textView.scroll(NSPoint(x: 0, y: max(0, rect.minY)))
        }
    }

    private static func answerText(_ result: AskResult) -> String {
        result.answer.isEmpty ? "I can only help with what you selected." : result.answer
    }

    /// The selection with each evidence quote highlighted. Long selections show just the quotes.
    private func passage(highlighting quotes: [String], in context: SelectionContext) -> NSAttributedString {
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

    /// Secondary text ("You asked:", "From the text:") in the reading font, a bit smaller, bold and dimmer.
    private func label(_ s: String) -> NSAttributedString {
        let base = settings.font
        let sized = NSFont(descriptor: base.fontDescriptor, size: max(12, base.pointSize * 0.8)) ?? base
        let font = NSFontManager.shared.convert(sized, toHaveTrait: .boldFontMask)
        var attrs = settings.textAttributes
        attrs[.font] = font
        attrs[.foregroundColor] = settings.textColor.withAlphaComponent(0.6)
        attrs[.kern] = CGFloat(settings.letterSpacing) * font.pointSize
        return NSAttributedString(string: s, attributes: attrs)
    }

    private func gap() -> NSAttributedString {
        NSAttributedString(string: "\n\n", attributes: [.font: NSFont.systemFont(ofSize: 8)])
    }

    // MARK: - Controls in the reading settings

    /// Question box and send button use the reading font and size.
    private func applySettings() {
        field.font = settings.font
        field.placeholderAttributedString = NSAttributedString(string: "Ask about this…", attributes: [
            .font: settings.font,
            .foregroundColor: NSColor.placeholderTextColor,
            .kern: CGFloat(settings.letterSpacing * settings.fontSize),
        ])
        sendButton.contentTintColor = settings.textColor
        needsLayout = true
    }

    /// Chips use the reading font, size, and letter/word spacing (one line each).
    private func setSuggestions(_ list: [String]) {
        suggestions = list
        chips.subviews.forEach { $0.removeFromSuperview() }
        let color = settings.textColor
        for title in list {
            let chip = FirstClickButton(title: title, target: self, action: #selector(chipTapped(_:)))
            chip.isBordered = false
            chip.cell?.wraps = true
            chip.cell?.lineBreakMode = .byWordWrapping
            let styled = NSMutableAttributedString(attributedString: settings.styled(title))
            let whole = NSRange(location: 0, length: styled.length)
            styled.removeAttribute(.paragraphStyle, range: whole)
            styled.addAttribute(.foregroundColor, value: color, range: whole)
            chip.attributedTitle = styled
            chip.wantsLayer = true
            chip.layer?.cornerRadius = chipHeight / 2
            chip.layer?.borderWidth = 1
            chip.layer?.borderColor = color.withAlphaComponent(0.25).cgColor
            chip.layer?.backgroundColor = color.withAlphaComponent(0.06).cgColor
            chips.addSubview(chip)
        }
        needsLayout = true
        layoutSubtreeIfNeeded()
    }

    private var lineHeight: CGFloat {
        let f = settings.font
        return ceil(f.ascender - f.descender + f.leading)
    }
    private var chipHeight: CGFloat { lineHeight + 10 }
    private var fieldHeight: CGFloat { max(28, lineHeight + 10) }

    private func setSpeaking(_ playing: Bool) {
        let name = playing ? "pause.fill" : "speaker.wave.2.fill"
        speakButton.image = NSImage(systemSymbolName: name, accessibilityDescription: playing ? "Pause" : "Read answer aloud")
        speakButton.toolTip = playing ? "Pause" : "Read the latest answer aloud"
        speakButton.contentTintColor = settings.textColor
    }

    /// Puts the cursor back in the question box for the next question.
    private func focusField() {
        window?.makeFirstResponder(field)
    }

    // MARK: - Actions

    @objc private func submit() {
        let q = field.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty, field.isEnabled else { return }
        onAsk?(q)
    }

    @objc private func chipTapped(_ sender: NSButton) {
        guard field.isEnabled else { return }
        field.stringValue = sender.attributedTitle.string
        submit()
    }

    @objc private func speak() {
        guard let latest = turns.last else { return }
        reader.rate = Float(settings.readingSpeed)
        reader.voiceIdentifier = settings.voice
        reader.togglePlay(Self.answerText(latest.result))
    }

    // MARK: - Layout (frames by hand, like the rest of the popup)

    /// Top to bottom: Back (drawn by Popup) and 🔊, the conversation, suggestion chips, the question box.
    override func layout() {
        super.layout()
        let w = bounds.width, pad: CGFloat = 12, topBar: CGFloat = 36

        field.frame = NSRect(x: pad, y: pad, width: w - pad * 2 - 32, height: fieldHeight)
        sendButton.frame = NSRect(x: w - pad - 28, y: pad + (fieldHeight - 28) / 2, width: 28, height: 28)
        var bottom = pad + fieldHeight

        // Chips flow left to right and wrap.
        var x: CGFloat = 0, lineY: CGFloat = 0, rowBottom: CGFloat = 0
        let maxWidth = w - pad * 2, h = chipHeight
        var frames: [NSRect] = []
        for chip in chips.subviews {
            // Long chips take the full width and wrap onto more lines instead of being cut off.
            var size = NSSize(width: chip.fittingSize.width + 20, height: h)
            if size.width > maxWidth, let title = (chip as? NSButton)?.attributedTitle {
                let text = title.boundingRect(with: NSSize(width: maxWidth - 20, height: .greatestFiniteMagnitude),
                                              options: [.usesLineFragmentOrigin, .usesFontLeading])
                size = NSSize(width: maxWidth, height: max(h, ceil(text.height) + 10))
            }
            if x > 0 && x + size.width > maxWidth { x = 0; lineY = rowBottom + 6 }
            frames.append(NSRect(origin: NSPoint(x: x, y: lineY), size: size))
            rowBottom = max(rowBottom, lineY + size.height)
            x += size.width + 6
        }
        let chipsHeight = chips.subviews.isEmpty ? 0 : rowBottom
        if chipsHeight > 0 { bottom += 8 }
        chips.frame = NSRect(x: pad, y: bottom, width: maxWidth, height: chipsHeight)
        bottom += chipsHeight
        // Flip so the first line is on top.
        for (chip, f) in zip(chips.subviews, frames) {
            chip.frame = NSRect(x: f.minX, y: chipsHeight - f.maxY, width: f.width, height: f.height)
        }

        bottom += 8
        let top = bounds.height - topBar
        scroll.frame = NSRect(x: pad - 4, y: bottom, width: w - pad * 2 + 8, height: max(0, top - bottom))
        speakButton.frame = NSRect(x: w - pad - 32, y: top + 4, width: 32, height: 28)
    }
}
