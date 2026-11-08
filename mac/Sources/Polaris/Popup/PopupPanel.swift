// Floating popup near the cursor: a menu of features first, then the reader, Ask, or the AI response.
import AppKit

final class FloatingPanel: NSPanel {
    override var canBecomeKey: Bool { true }
}

enum PopupAction {
    case read, ask, simplify
}

@MainActor
final class Popup {
    private let circleSize: CGFloat = 52
    private let circleSpacing: CGFloat = 14
    private var menuSize: NSSize { NSSize(width: circleSize * 3 + circleSpacing * 2, height: circleSize) }
    private let contentSize = NSSize(width: 420, height: 320)
    private let askSize = NSSize(width: 440, height: 400)
    private let barHeight: CGFloat = 32

    private let panel: FloatingPanel
    private let background: NSVisualEffectView
    private let tint = NSView()
    private let menu = NSView()
    private let scroll: NSScrollView
    private let textView: NSTextView
    private let controls = ReaderControls(frame: .zero)
    private let backButton = FirstClickButton()
    let ask = AskPanel(frame: .zero)
    private let reader = SpeechReader()
    private let highlighter: WordHighlighter
    private var anchor = NSPoint.zero
    private var isReading = false
    private(set) var text = ""
    /// True while a feature view is showing, so Back can return to the circles.
    private(set) var canGoBack = false

    var onAction: ((PopupAction) -> Void)?
    var onBack: (() -> Void)?
    var isVisible: Bool { panel.isVisible }

    init() {
        let rect = NSRect(origin: .zero, size: contentSize)
        panel = FloatingPanel(contentRect: rect,
                              styleMask: [.borderless, .nonactivatingPanel],
                              backing: .buffered, defer: false)
        panel.level = .floating
        panel.isFloatingPanel = true
        panel.hidesOnDeactivate = false
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]

        let effect = NSVisualEffectView(frame: rect)
        effect.material = .popover
        effect.blendingMode = .behindWindow
        effect.state = .active
        effect.wantsLayer = true
        effect.layer?.cornerRadius = 12
        effect.layer?.masksToBounds = true
        background = effect
        tint.wantsLayer = true
        effect.addSubview(tint)

        scroll = NSScrollView(frame: rect)
        scroll.hasVerticalScroller = true
        scroll.drawsBackground = false
        // Subview frames are set by hand in layoutContent/place, so nothing resizes them behind our back.
        scroll.autoresizingMask = []

        textView = NSTextView(frame: scroll.contentView.bounds)
        textView.isEditable = false
        textView.isSelectable = true
        textView.drawsBackground = false
        textView.textContainerInset = NSSize(width: 4, height: 4)
        textView.minSize = .zero
        textView.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: .greatestFiniteMagnitude)
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.autoresizingMask = [.width]
        textView.textContainer?.widthTracksTextView = true
        scroll.documentView = textView

        controls.autoresizingMask = []
        backButton.image = NSImage(systemSymbolName: "chevron.left", accessibilityDescription: "Back")
        backButton.imagePosition = .imageLeading
        backButton.bezelStyle = .regularSquare
        backButton.isBordered = false
        backButton.toolTip = "Back to the three icons (Delete)"

        // The rounded background only shows behind text; the menu is just three floating circles.
        let container = NSView(frame: rect)
        container.addSubview(effect)
        container.addSubview(menu)
        container.addSubview(scroll)
        container.addSubview(controls)
        container.addSubview(ask)
        container.addSubview(backButton)
        panel.contentView = container

        highlighter = WordHighlighter(textView: textView)
        backButton.target = self
        backButton.action = #selector(backTapped)

        let buttons: [(String, String, PopupAction)] = [
            ("Read aloud", "speaker.wave.2.fill", .read),
            ("Ask", "questionmark.bubble", .ask),
            ("Simplify", "wand.and.stars", .simplify),
        ]
        for (i, (title, symbol, action)) in buttons.enumerated() {
            let button = CircleButton(title: title, symbol: symbol, diameter: circleSize) { [weak self] in
                self?.onAction?(action)
            }
            button.setFrameOrigin(NSPoint(x: CGFloat(i) * (circleSize + circleSpacing), y: 0))
            menu.addSubview(button)
        }

        reader.onWord = { [weak self] range in self?.highlighter.highlight(range) }
        reader.onStateChange = { [weak self] playing in self?.controls.setPlaying(playing) }
        controls.onPlayPause = { [weak self] in self?.togglePlay() }
        controls.onPrev = { [weak self] in self?.step(-1) }
        controls.onNext = { [weak self] in self?.step(1) }
    }

    // MARK: - Modes

    /// The first view after circling: one button per feature.
    func showMenu(near p: NSPoint) {
        anchor = p
        stopReading()
        canGoBack = false
        menu.isHidden = false
        background.isHidden = true
        scroll.isHidden = true
        controls.isHidden = true
        backButton.isHidden = true
        ask.isHidden = true
        ask.stop()
        place(menuSize, hugCursor: true)
        panel.orderFrontRegardless()
    }

    /// The Ask view: question box focused so the user can type right away.
    func showAsk(context: SelectionContext?) {
        stopReading()
        layoutContent(back: true, readerControls: false, size: askSize)
        scroll.isHidden = true
        ask.isHidden = false
        ask.frame = NSRect(origin: .zero, size: askSize)
        ask.reset(context: context)
        panel.orderFrontRegardless()
        panel.makeKey()
        panel.makeFirstResponder(ask.field)
    }

    /// True while the user is typing in a text box (so Space, arrows and Delete type normally).
    var isTyping: Bool { (panel.firstResponder as? NSTextView)?.isFieldEditor == true }

    /// Returns to the three circles where they were.
    func backToMenu() { showMenu(near: anchor) }

    /// Plain text (a status message or an AI response), no reader controls.
    /// `canGoBack` adds a Back button (off for messages shown before the menu).
    func showText(_ s: String, near p: NSPoint? = nil, canGoBack: Bool = false) {
        if let p { anchor = p }
        stopReading()
        layoutContent(back: canGoBack, readerControls: false)
        setText(s)
        panel.orderFrontRegardless()
    }

    /// Reads `s` aloud, highlighting each word, formatted with the user's reading settings.
    func showReader(_ s: String) {
        layoutContent(back: true, readerControls: true)
        isReading = true
        setText(s)
        let settings = SettingsStore.shared.settings
        reader.rate = Float(settings.readingSpeed)
        reader.voiceIdentifier = settings.voice
        reader.play(text)
        panel.orderFrontRegardless()
    }

    func hide() {
        stopReading()
        ask.stop()
        panel.orderOut(nil)
    }

    // MARK: - Reader

    func togglePlay() { if isReading { reader.togglePlay(text) } }
    func step(_ delta: Int) { if isReading { reader.step(delta, text) } }

    private func stopReading() {
        isReading = false
        reader.stop()
    }

    // MARK: - Text

    func setText(_ s: String) {
        text = s
        textView.textStorage?.setAttributedString(SettingsStore.shared.settings.styled(s))
        textView.scrollToBeginningOfDocument(nil)
    }

    func append(_ s: String) {
        text += s
        textView.textStorage?.append(SettingsStore.shared.settings.styled(s))
        textView.scrollToEndOfDocument(nil)
    }

    // MARK: - Layout

    private func layoutContent(back: Bool, readerControls: Bool, size: NSSize? = nil) {
        let size = size ?? contentSize
        canGoBack = back
        menu.isHidden = true
        background.isHidden = false
        scroll.isHidden = false
        ask.isHidden = true
        ask.stop()
        controls.isHidden = !readerControls
        backButton.isHidden = !back
        place(size)
        let bar = back || readerControls ? barHeight : 0
        scroll.frame = NSRect(x: 8, y: 8 + bar, width: size.width - 16, height: size.height - 16 - bar)
        controls.frame = NSRect(x: 0, y: 4, width: size.width, height: barHeight)
        backButton.frame = NSRect(x: 12, y: 4, width: 60, height: barHeight)
        let color = SettingsStore.shared.settings.textColor
        background.appearance = SettingsStore.shared.settings.appearance
        ask.appearance = SettingsStore.shared.settings.appearance
        backButton.contentTintColor = color
        backButton.attributedTitle = NSAttributedString(string: "Back", attributes: [
            .font: NSFont.systemFont(ofSize: 12), .foregroundColor: color,
        ])
    }

    @objc private func backTapped() { onBack?() }

    /// Sizes the panel and positions it next to the anchor point, kept on screen.
    /// `hugCursor` puts it just right of the cursor, centered on it (for the circle menu).
    private func place(_ size: NSSize, hugCursor: Bool = false) {
        let p = anchor
        let screen = NSScreen.screens.first { NSMouseInRect(p, $0.frame, false) } ?? NSScreen.main
        let vf = screen?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let w = size.width, h = size.height

        let gap: CGFloat = hugCursor ? 6 : 18
        var x = p.x + gap
        var y = hugCursor ? p.y - h / 2 : p.y - h - gap
        if x + w > vf.maxX { x = p.x - w - gap }
        if y < vf.minY { y = p.y + gap }
        x = max(vf.minX, min(x, vf.maxX - w))
        y = max(vf.minY, min(y, vf.maxY - h))

        panel.setFrame(NSRect(x: x, y: y, width: w, height: h), display: true)
        background.frame = NSRect(origin: .zero, size: size)
        tint.frame = background.bounds
        tint.layer?.backgroundColor = SettingsStore.shared.settings.backgroundColor.cgColor
        controls.setTint(SettingsStore.shared.settings.textColor)
        menu.frame = NSRect(origin: .zero, size: size)
        panel.invalidateShadow()
    }
}

/// A round, blurred button with just an icon (the name shows as a tooltip), used in the feature menu.
@MainActor
private final class CircleButton: NSView {
    private let handler: () -> Void

    init(title: String, symbol: String, diameter: CGFloat, handler: @escaping () -> Void) {
        self.handler = handler
        super.init(frame: NSRect(x: 0, y: 0, width: diameter, height: diameter))
        toolTip = title

        let circle = NSVisualEffectView(frame: bounds)
        circle.material = .popover
        circle.blendingMode = .behindWindow
        circle.state = .active
        circle.wantsLayer = true
        circle.layer?.cornerRadius = diameter / 2
        circle.layer?.masksToBounds = true
        addSubview(circle)

        let button = FirstClickButton(frame: bounds)
        button.image = NSImage(systemSymbolName: symbol, accessibilityDescription: title)?
            .withSymbolConfiguration(.init(pointSize: 20, weight: .regular))
        button.imagePosition = .imageOnly
        button.bezelStyle = .regularSquare
        button.isBordered = false
        button.contentTintColor = .labelColor
        button.target = self
        button.action = #selector(tapped)
        addSubview(button)
    }

    required init?(coder: NSCoder) { fatalError() }

    @objc private func tapped() { handler() }
}

/// Responds to the first click even when the popup isn't the key window.
final class FirstClickButton: NSButton {
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}
