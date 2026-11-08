// Floating popup near the cursor: a menu of features first, then the reader, Ask, or Write.
import AppKit

final class FloatingPanel: NSPanel {
    override var canBecomeKey: Bool { true }
}

enum PopupAction {
    case read, ask, write, screenshot
}

@MainActor
final class Popup {
    private let circleSize: CGFloat = 52
    private let circleSpacing: CGFloat = 14
    private let menuButtons: [(String, String, PopupAction)] = [
        ("Read aloud", "speaker.wave.2.fill", .read),
        ("Ask or simplify", "questionmark.bubble", .ask),
        ("Write by talking", "mic.fill", .write),
        ("Screenshot part of the screen", "camera.viewfinder", .screenshot),
    ]
    private var menuSize: NSSize {
        let n = CGFloat(menuButtons.count + (thumbnail.image == nil ? 0 : 1))
        return NSSize(width: circleSize * n + circleSpacing * (n - 1), height: circleSize)
    }
    private let contentSize = NSSize(width: 420, height: 320)
    /// Ask grows with the reading font so big text still has room (place() keeps it on screen).
    private var askSize: NSSize {
        let scale = CGFloat(max(1, SettingsStore.shared.settings.fontSize / 16))
        return NSSize(width: min(440 * scale, 640), height: min(400 * scale, 680))
    }
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
    let write = WritePanel(frame: .zero)
    private var circles: [(PopupAction, CircleButton)] = []
    /// The screenshot the features are using, shown before the circles.
    private let thumbnail = NSImageView()
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
        backButton.image = NSImage(systemSymbolName: "chevron.left", accessibilityDescription: "Back")?
            .withSymbolConfiguration(.init(pointSize: 14, weight: .semibold))
        backButton.imagePosition = .imageOnly
        backButton.bezelStyle = .regularSquare
        backButton.isBordered = false
        backButton.toolTip = "Back to the icons (Delete)"

        // The rounded background only shows behind text; the menu is just floating circles.
        let container = NSView(frame: rect)
        container.addSubview(effect)
        container.addSubview(menu)
        container.addSubview(scroll)
        container.addSubview(controls)
        container.addSubview(ask)
        container.addSubview(write)
        container.addSubview(backButton)
        panel.contentView = container

        highlighter = WordHighlighter(textView: textView)
        backButton.target = self
        backButton.action = #selector(backTapped)

        thumbnail.imageScaling = .scaleProportionallyUpOrDown
        thumbnail.wantsLayer = true
        thumbnail.layer?.cornerRadius = 10
        thumbnail.layer?.masksToBounds = true
        thumbnail.layer?.borderWidth = 2
        thumbnail.layer?.borderColor = NSColor.white.withAlphaComponent(0.9).cgColor
        thumbnail.layer?.backgroundColor = NSColor.black.withAlphaComponent(0.2).cgColor
        thumbnail.toolTip = "Using this screenshot"
        menu.addSubview(thumbnail)

        for (title, symbol, action) in menuButtons {
            let button = CircleButton(title: title, symbol: symbol, diameter: circleSize) { [weak self] in
                self?.onAction?(action)
            }
            menu.addSubview(button)
            circles.append((action, button))
        }

        reader.onWord = { [weak self] range in self?.highlighter.highlight(range) }
        reader.onStateChange = { [weak self] playing in self?.controls.setPlaying(playing) }
        // While the voice gets ready: spinner + "Preparing voice…", and the first word pulses.
        reader.onLoading = { [weak self] range in
            guard let self else { return }
            self.controls.setLoading(range != nil)
            if let range { self.highlighter.showPending(range) } else { self.highlighter.clear() }
        }
        controls.onPlayPause = { [weak self] in self?.togglePlay() }
        controls.onPrev = { [weak self] in self?.step(-1) }
        controls.onNext = { [weak self] in self?.step(1) }
    }

    // MARK: - Modes

    /// The first view after circling: one button per feature. Without a selection only Write works.
    /// Shows `image` before the circles while the features use a screenshot (nil hides it).
    func setThumbnail(_ image: NSImage?) {
        thumbnail.image = image
    }

    func showMenu(near p: NSPoint, hasSelection: Bool? = nil) {
        anchor = p
        if let hasSelection {
            for (action, circle) in circles { circle.isEnabled = hasSelection || action == .write || action == .screenshot }
        }
        stopReading()
        canGoBack = false
        menu.isHidden = false
        background.isHidden = true
        scroll.isHidden = true
        controls.isHidden = true
        backButton.isHidden = true
        ask.isHidden = true
        ask.stop()
        write.isHidden = true
        write.stop()
        // Screenshot thumbnail first (if any), then the circles.
        let step = circleSize + circleSpacing
        thumbnail.isHidden = thumbnail.image == nil
        thumbnail.frame = NSRect(x: 0, y: 0, width: circleSize, height: circleSize)
        let offset: CGFloat = thumbnail.isHidden ? 0 : step
        for (i, (_, circle)) in circles.enumerated() {
            circle.setFrameOrigin(NSPoint(x: offset + CGFloat(i) * step, y: 0))
        }
        place(menuSize, hugCursor: true)
        panel.orderFrontRegardless()
    }

    /// The Ask view: question box focused so the user can type right away.
    func showAsk(context: SelectionContext?) {
        stopReading()
        let size = askSize
        layoutContent(back: true, readerControls: false, size: size)
        scroll.isHidden = true
        ask.isHidden = false
        ask.frame = NSRect(origin: .zero, size: panel.frame.size)
        ask.reset(context: context)
        panel.orderFrontRegardless()
        panel.makeKey()
        panel.makeFirstResponder(ask.field)
    }

    /// Write: talk, then turn it into a note. Nothing is focused, so Space toggles the mic.
    func showWrite(context: SelectionContext?, sourceApp: String?, near p: NSPoint? = nil) {
        if let p { anchor = p }
        stopReading()
        let size = askSize
        layoutContent(back: true, readerControls: false, size: size)
        scroll.isHidden = true
        write.isHidden = false
        write.frame = NSRect(origin: .zero, size: panel.frame.size)
        write.reset(context: context, sourceApp: sourceApp)
        panel.orderFrontRegardless()
        panel.makeKey()
        panel.makeFirstResponder(nil)
    }

    /// True while the user is typing in a text box or editing a note (so Space, arrows and Delete type normally).
    var isTyping: Bool {
        guard let tv = panel.firstResponder as? NSTextView else { return false }
        return tv.isFieldEditor || tv.isEditable
    }

    /// Returns to the menu circles where they were.
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
        write.stop()
        panel.orderOut(nil)
    }

    // MARK: - Reader

    func togglePlay() {
        if isReading { reader.togglePlay(text) } else if !write.isHidden { write.spaceKey() }
    }
    func step(_ delta: Int) {
        if isReading { reader.step(delta, text) } else if !write.isHidden { write.step(delta) }
    }

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

    // MARK: - Layout

    private func layoutContent(back: Bool, readerControls: Bool, size: NSSize? = nil) {
        place(size ?? contentSize)
        // place() may shrink it to fit the screen.
        let size = panel.frame.size
        canGoBack = back
        menu.isHidden = true
        background.isHidden = false
        scroll.isHidden = false
        ask.isHidden = true
        ask.stop()
        write.isHidden = true
        write.stop()
        controls.isHidden = !readerControls
        backButton.isHidden = !back
        // Back sits in a bar at the top; the reader's play controls in one at the bottom.
        let topBar = back ? barHeight : 0, bottomBar = readerControls ? barHeight : 0
        scroll.frame = NSRect(x: 8, y: 8 + bottomBar, width: size.width - 16,
                              height: size.height - 16 - topBar - bottomBar)
        controls.frame = NSRect(x: 0, y: 4, width: size.width, height: barHeight)
        backButton.frame = NSRect(x: 8, y: size.height - barHeight - 4, width: barHeight, height: barHeight)
        let color = SettingsStore.shared.settings.textColor
        background.appearance = SettingsStore.shared.settings.appearance
        ask.appearance = SettingsStore.shared.settings.appearance
        write.appearance = SettingsStore.shared.settings.appearance
        backButton.contentTintColor = color
    }

    @objc private func backTapped() { onBack?() }

    /// Sizes the panel and positions it next to the anchor point, kept on screen.
    /// `hugCursor` puts it just right of the cursor, centered on it (for the circle menu).
    private func place(_ size: NSSize, hugCursor: Bool = false) {
        let p = anchor
        let screen = NSScreen.screens.first { NSMouseInRect(p, $0.frame, false) } ?? NSScreen.main
        let vf = screen?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let w = min(size.width, vf.width - 20), h = min(size.height, vf.height - 20)

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
    private let title: String
    private let button: FirstClickButton

    init(title: String, symbol: String, diameter: CGFloat, handler: @escaping () -> Void) {
        self.handler = handler
        self.title = title
        button = FirstClickButton(frame: NSRect(x: 0, y: 0, width: diameter, height: diameter))
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

    /// Dimmed and unclickable when off (Read and Ask need selected text).
    var isEnabled = true {
        didSet {
            button.isEnabled = isEnabled
            alphaValue = isEnabled ? 1 : 0.35
            toolTip = isEnabled ? title : "\(title) (select some text first)"
        }
    }
}

/// Responds to the first click even when the popup isn't the key window.
final class FirstClickButton: NSButton {
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}
