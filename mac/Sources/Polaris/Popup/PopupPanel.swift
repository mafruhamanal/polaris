// Floating popup near the cursor: a menu of features first, then the reader or the AI response.
import AppKit

final class FloatingPanel: NSPanel {
    override var canBecomeKey: Bool { true }
}

enum PopupAction {
    case read, explain, simplify
}

@MainActor
final class Popup {
    private let circleSize: CGFloat = 52
    private let circleSpacing: CGFloat = 14
    private var menuSize: NSSize { NSSize(width: circleSize * 3 + circleSpacing * 2, height: circleSize) }
    private let contentSize = NSSize(width: 420, height: 320)
    private let barHeight: CGFloat = 32

    private let panel: FloatingPanel
    private let background: NSVisualEffectView
    private let menu: NSStackView
    private let scroll: NSScrollView
    private let textView: NSTextView
    private let controls = ReaderControls(frame: .zero)
    private let reader = SpeechReader()
    private let highlighter: WordHighlighter
    private var anchor = NSPoint.zero
    private var isReading = false
    private(set) var text = ""

    var onAction: ((PopupAction) -> Void)?
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
        effect.autoresizingMask = [.width, .height]
        background = effect

        menu = NSStackView()
        menu.distribution = .fillEqually
        menu.spacing = circleSpacing
        menu.autoresizingMask = [.width, .height]

        scroll = NSScrollView(frame: rect)
        scroll.hasVerticalScroller = true
        scroll.drawsBackground = false
        scroll.autoresizingMask = [.width, .height]

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

        controls.autoresizingMask = [.width, .maxYMargin]

        // The rounded background only shows behind text; the menu is just three floating circles.
        let container = NSView(frame: rect)
        container.addSubview(effect)
        container.addSubview(menu)
        container.addSubview(scroll)
        container.addSubview(controls)
        panel.contentView = container

        highlighter = WordHighlighter(textView: textView)

        let buttons: [(String, String, PopupAction)] = [
            ("Read aloud", "speaker.wave.2.fill", .read),
            ("Explain", "text.bubble", .explain),
            ("Simplify", "wand.and.stars", .simplify),
        ]
        for (title, symbol, action) in buttons {
            menu.addArrangedSubview(CircleButton(title: title, symbol: symbol, diameter: circleSize) { [weak self] in
                self?.onAction?(action)
            })
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
        menu.isHidden = false
        background.isHidden = true
        scroll.isHidden = true
        controls.isHidden = true
        place(menuSize, hugCursor: true)
        panel.orderFrontRegardless()
    }

    /// Plain text (a status message or an AI response), no reader controls.
    func showText(_ s: String, near p: NSPoint? = nil) {
        if let p { anchor = p }
        stopReading()
        layoutContent(withBar: false)
        setText(s)
        panel.orderFrontRegardless()
    }

    /// Reads `s` aloud, highlighting each word, formatted with the user's reading settings.
    func showReader(_ s: String) {
        layoutContent(withBar: true)
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
        textView.textStorage?.setAttributedString(
            NSAttributedString(string: s, attributes: SettingsStore.shared.settings.textAttributes))
        textView.scrollToBeginningOfDocument(nil)
    }

    func append(_ s: String) {
        text += s
        textView.textStorage?.append(
            NSAttributedString(string: s, attributes: SettingsStore.shared.settings.textAttributes))
        textView.scrollToEndOfDocument(nil)
    }

    // MARK: - Layout

    private func layoutContent(withBar: Bool) {
        menu.isHidden = true
        background.isHidden = false
        scroll.isHidden = false
        controls.isHidden = !withBar
        place(contentSize)
        let bar = withBar ? barHeight : 0
        scroll.frame = NSRect(x: 8, y: 8 + bar, width: contentSize.width - 16, height: contentSize.height - 16 - bar)
        controls.frame = NSRect(x: 0, y: 4, width: contentSize.width, height: barHeight)
    }

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
        translatesAutoresizingMaskIntoConstraints = false
        widthAnchor.constraint(equalToConstant: diameter).isActive = true
        heightAnchor.constraint(equalToConstant: diameter).isActive = true

        let circle = NSVisualEffectView(frame: bounds)
        circle.material = .popover
        circle.blendingMode = .behindWindow
        circle.state = .active
        circle.wantsLayer = true
        circle.layer?.cornerRadius = diameter / 2
        circle.layer?.masksToBounds = true
        circle.autoresizingMask = [.width, .height]
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
        button.autoresizingMask = [.width, .height]
        addSubview(button)
    }

    required init?(coder: NSCoder) { fatalError() }

    @objc private func tapped() { handler() }
}

/// Responds to the first click even when the popup isn't the key window.
private final class FirstClickButton: NSButton {
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}
