// Floating popup near the cursor: a menu of features first, then the reader, Ask, or Write.
import AppKit

final class FloatingPanel: NSPanel {
    override var canBecomeKey: Bool { true }
}

enum PopupAction: CaseIterable {
    case read, ask, write, screenshot

    /// Short name under the menu circle.
    var label: String {
        switch self {
        case .read: return "Read"
        case .ask: return "Ask"
        case .write: return "Write"
        case .screenshot: return "Snap"
        }
    }

    /// Name in the feature's header, and the circle's tooltip.
    var title: String {
        switch self {
        case .read: return "Read aloud"
        case .ask: return "Ask or simplify"
        case .write: return "Write by talking"
        case .screenshot: return "Screenshot part of the screen"
        }
    }

    var symbol: String {
        switch self {
        case .read: return "speaker.wave.2.fill"
        case .ask: return "questionmark.bubble.fill"
        case .write: return "mic.fill"
        case .screenshot: return "camera.viewfinder"
        }
    }

    /// Each feature's color, on its menu circle and in its header.
    var color: NSColor {
        switch self {
        case .read: return .systemBlue
        case .ask: return .systemPurple
        case .write: return .systemOrange
        case .screenshot: return .systemGreen
        }
    }
}

@MainActor
final class Popup {
    private let circleSize: CGFloat = 52
    private let circleSpacing: CGFloat = 8
    private var menuSize: NSSize {
        let cell = CircleButton.cellSize(circleSize)
        let thumbWidth = thumbnail.image == nil ? 0 : thumbnailWidth + circleSpacing
        let n = CGFloat(circles.count)
        return NSSize(width: thumbWidth + cell.width * n + circleSpacing * (n - 1), height: cell.height)
    }
    private let thumbnailWidth: CGFloat = 76
    private let contentSize = NSSize(width: 420, height: 320)
    /// Ask grows with the reading font so big text still has room (place() keeps it on screen).
    private var askSize: NSSize {
        let scale = CGFloat(max(1, SettingsStore.shared.settings.fontSize / 16))
        return NSSize(width: min(440 * scale, 640), height: min(400 * scale, 680))
    }
    private let barHeight: CGFloat = 32
    private let minSize = NSSize(width: 300, height: 220)

    private let panel: FloatingPanel
    private let background: NSVisualEffectView
    private let tint = NSView()
    private let menu = NSView()
    private let scroll: NSScrollView
    private let textView: NSTextView
    private let controls = ReaderControls(frame: .zero)
    private let backButton = FirstClickButton()
    private let closeButton = FirstClickButton()
    private let dragHandle = DragHandle()
    private let badge = NSView()
    private let badgeIcon = NSImageView()
    private let headerTitle = NSTextField(labelWithString: "")
    private let grip = ResizeGrip()
    let ask = AskPanel(frame: .zero)
    let write = WritePanel(frame: .zero)
    private var circles: [(PopupAction, CircleButton)] = []
    /// The screenshot the features are using, shown before the circles.
    private let thumbnail = ThumbnailView()
    private let reader = SpeechReader()
    private let highlighter: WordHighlighter
    private let clicks = TextClickWatcher()
    private let wordHelp = WordHelp()
    private var anchor = NSPoint.zero
    private var isReading = false
    /// The feature showing (nil for the menu or a plain message): its header and remembered size.
    private var feature: PopupAction?
    private(set) var text = ""
    /// True while a feature view is showing, so Back can return to the circles.
    private(set) var canGoBack = false

    var onAction: ((PopupAction) -> Void)?
    var onBack: (() -> Void)?
    var onClose: (() -> Void)?
    var isVisible: Bool { panel.isVisible }
    var isShowingMenu: Bool { panel.isVisible && !menu.isHidden }
    var isReadingAloud: Bool { panel.isVisible && isReading }

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
        effect.layer?.cornerRadius = 14
        effect.layer?.masksToBounds = true
        background = effect
        tint.wantsLayer = true
        effect.addSubview(tint)

        scroll = NSScrollView(frame: rect)
        scroll.hasVerticalScroller = true
        scroll.drawsBackground = false
        // Subview frames are set by hand in layoutFrames/place, so nothing resizes them behind our back.
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
        textView.delegate = clicks
        scroll.documentView = textView

        controls.autoresizingMask = []
        Self.styleIcon(backButton, "chevron.left", "Back to the icons (Delete)")
        Self.styleIcon(closeButton, "xmark", "Close (Esc)")

        badge.wantsLayer = true
        badge.layer?.cornerRadius = 12
        badgeIcon.imageScaling = .scaleNone
        badgeIcon.contentTintColor = .white
        badge.addSubview(badgeIcon)
        headerTitle.lineBreakMode = .byTruncatingTail
        dragHandle.addSubview(badge)
        dragHandle.addSubview(headerTitle)
        dragHandle.toolTip = "Drag to move"

        // The rounded background only shows behind text; the menu is just floating circles.
        let container = NSView(frame: rect)
        for v in [effect, menu, scroll, controls, ask, write, dragHandle, backButton, closeButton, grip] as [NSView] {
            container.addSubview(v)
        }
        panel.contentView = container

        highlighter = WordHighlighter(textView: textView)
        backButton.target = self
        backButton.action = #selector(backTapped)
        closeButton.target = self
        closeButton.action = #selector(closeTapped)
        grip.onResize = { [weak self] size in self?.resize(to: size) }
        grip.onEnd = { [weak self] in self?.rememberSize() }

        menu.addSubview(thumbnail)
        for action in PopupAction.allCases {
            let button = CircleButton(action: action, diameter: circleSize) { [weak self] in
                self?.onAction?(action)
            }
            menu.addSubview(button)
            circles.append((action, button))
        }

        reader.onWord = { [weak self] range in self?.highlighter.highlight(range) }
        reader.onStateChange = { [weak self] playing in
            self?.controls.setPlaying(playing)
            if playing { self?.wordHelp.close() }
        }
        // While the voice gets ready: spinner + "Preparing voice…", and the first word pulses.
        reader.onLoading = { [weak self] range in
            guard let self else { return }
            self.controls.setLoading(range != nil)
            if let range { self.highlighter.showPending(range) } else { self.highlighter.clear() }
        }
        controls.onPlayPause = { [weak self] in self?.togglePlay() }
        controls.onPrev = { [weak self] in self?.step(-1) }
        controls.onNext = { [weak self] in self?.step(1) }
        controls.onWordHelp = { [weak self] in self?.showWordHelp() }
        // While paused, clicking a word moves reading (and Word help) to it.
        clicks.onClick = { [weak self] location in
            guard let self, self.isReading, !self.reader.isPlaying else { return }
            self.reader.jump(to: location, self.text)
        }
    }

    private static func styleIcon(_ button: NSButton, _ symbol: String, _ tip: String) {
        button.image = NSImage(systemSymbolName: symbol, accessibilityDescription: tip)?
            .withSymbolConfiguration(.init(pointSize: 14, weight: .semibold))
        button.imagePosition = .imageOnly
        button.bezelStyle = .regularSquare
        button.isBordered = false
        button.toolTip = tip
    }

    // MARK: - Modes

    /// Shows `image` before the circles while the features use a screenshot (nil hides it).
    func setThumbnail(_ image: NSImage?) {
        thumbnail.image = image
    }

    /// The first view after circling: one button per feature. Without a selection only Write and
    /// Screenshot work. Keys 1–4 pick a feature.
    func showMenu(near p: NSPoint, hasSelection: Bool? = nil) {
        anchor = p
        if let hasSelection {
            for (action, circle) in circles { circle.isEnabled = hasSelection || action == .write || action == .screenshot }
        }
        stopReading()
        feature = nil
        canGoBack = false
        menu.isHidden = false
        for v in [background, scroll, controls, backButton, closeButton, dragHandle, grip, ask, write] as [NSView] {
            v.isHidden = true
        }
        ask.stop()
        write.stop()

        // Screenshot thumbnail first (if any), then the circles, all lined up with the circles' centers.
        let cell = CircleButton.cellSize(circleSize)
        thumbnail.isHidden = thumbnail.image == nil
        let discSide = cell.width
        thumbnail.frame = NSRect(x: 0, y: CircleButton.labelHeight + (discSide - circleSize) / 2,
                                 width: thumbnailWidth, height: circleSize)
        var x: CGFloat = thumbnail.isHidden ? 0 : thumbnailWidth + circleSpacing
        for (_, circle) in circles {
            circle.setFrameOrigin(NSPoint(x: x, y: 0))
            x += cell.width + circleSpacing
        }
        place(menuSize, hugCursor: true)
        menu.frame = NSRect(origin: .zero, size: panel.frame.size)
        panel.alphaValue = 1
        panel.orderFrontRegardless()
        // Key, so 1–4 reach us (the app you circled in stays active).
        panel.makeKey()
        popIn()
    }

    /// Picks the menu's `number`th feature (1-based), if it's available.
    func pick(_ number: Int) {
        guard isShowingMenu, circles.indices.contains(number - 1) else { return }
        let (action, circle) = circles[number - 1]
        if circle.isEnabled { onAction?(action) }
    }

    /// The Ask view: question box focused so the user can type right away.
    func showAsk(context: SelectionContext?) {
        stopReading()
        layoutContent(feature: .ask, back: true, readerControls: false)
        scroll.isHidden = true
        ask.isHidden = false
        ask.reset(context: context)
        layoutFrames()
        panel.orderFrontRegardless()
        panel.makeKey()
        panel.makeFirstResponder(ask.field)
    }

    /// Write: talk, then turn it into a note. Nothing is focused, so Space toggles the mic.
    func showWrite(context: SelectionContext?, sourceApp: String?, near p: NSPoint? = nil) {
        if let p { anchor = p }
        stopReading()
        layoutContent(feature: .write, back: true, readerControls: false)
        scroll.isHidden = true
        write.isHidden = false
        write.reset(context: context, sourceApp: sourceApp)
        layoutFrames()
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
        layoutContent(feature: nil, back: canGoBack, readerControls: false)
        setText(s)
        panel.orderFrontRegardless()
    }

    /// Reads `s` aloud, highlighting each word, formatted with the user's reading settings.
    func showReader(_ s: String) {
        layoutContent(feature: .read, back: true, readerControls: true)
        isReading = true
        setText(s)
        let settings = SettingsStore.shared.settings
        reader.rate = Float(settings.readingSpeed)
        reader.voiceIdentifier = settings.voice
        reader.play(text)
        panel.orderFrontRegardless()
        // Key, so W (Word help), Space and the arrows reach us.
        panel.makeKey()
        panel.makeFirstResponder(nil)
    }

    func hide() {
        stopReading()
        ask.stop()
        write.stop()
        thumbnail.hidePreview()
        panel.orderOut(nil)
    }

    // MARK: - Reader

    func togglePlay() {
        if isReading { reader.togglePlay(text) } else if !write.isHidden { write.spaceKey() }
    }
    func step(_ delta: Int) {
        if isReading { reader.step(delta, text) } else if !write.isHidden { write.step(delta) }
    }

    /// W: explains the word reading paused on (syllables, slow pronunciation, meaning).
    func showWordHelp() {
        guard isReading, !reader.isPlaying, !reader.isLoading, let range = reader.currentWord,
              let lm = textView.layoutManager, let tc = textView.textContainer else { return }
        let ns = text as NSString
        let word = ns.substring(with: range)
        var sentence = word
        ns.enumerateSubstrings(in: NSRange(location: 0, length: ns.length), options: .bySentences) { s, r, _, stop in
            if NSLocationInRange(range.location, r) { sentence = s ?? word; stop.pointee = true }
        }
        lm.ensureLayout(for: tc)
        let glyphs = lm.glyphRange(forCharacterRange: range, actualCharacterRange: nil)
        var rect = lm.boundingRect(forGlyphRange: glyphs, in: tc)
        rect.origin.x += textView.textContainerOrigin.x
        rect.origin.y += textView.textContainerOrigin.y
        textView.scrollRangeToVisible(range)
        wordHelp.show(word: word, sentence: sentence, relativeTo: rect, of: textView)
    }

    private func stopReading() {
        isReading = false
        reader.stop()
        wordHelp.close()
    }

    // MARK: - Text

    func setText(_ s: String) {
        text = s
        textView.textStorage?.setAttributedString(SettingsStore.shared.settings.styled(s))
        textView.scrollToBeginningOfDocument(nil)
    }

    // MARK: - Layout

    private func layoutContent(feature: PopupAction?, back: Bool, readerControls: Bool) {
        self.feature = feature
        thumbnail.hidePreview()
        place(feature.map(size(for:)) ?? contentSize)
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
        closeButton.isHidden = false
        dragHandle.isHidden = false
        grip.isHidden = false

        let settings = SettingsStore.shared.settings
        let color = settings.textColor
        for v in [background, ask, write] as [NSView] { v.appearance = settings.appearance }
        backButton.contentTintColor = color
        closeButton.contentTintColor = color
        badge.isHidden = feature == nil
        if let feature {
            badge.layer?.backgroundColor = feature.color.cgColor
            badgeIcon.image = NSImage(systemSymbolName: feature.symbol, accessibilityDescription: nil)?
                .withSymbolConfiguration(.init(pointSize: 12, weight: .semibold))
            let font = NSFont(descriptor: settings.font.fontDescriptor, size: 15) ?? .systemFont(ofSize: 15)
            headerTitle.font = NSFontManager.shared.convert(font, toHaveTrait: .boldFontMask)
            headerTitle.textColor = color
            headerTitle.stringValue = feature.title
        } else {
            headerTitle.stringValue = ""
        }
        layoutFrames()
        fadeIn()
    }

    /// Positions everything for the panel's current size (after showing a view or resizing).
    private func layoutFrames() {
        let size = panel.frame.size, w = size.width, h = size.height
        background.frame = NSRect(origin: .zero, size: size)
        tint.frame = background.bounds
        tint.layer?.backgroundColor = SettingsStore.shared.settings.backgroundColor.cgColor
        controls.setTint(SettingsStore.shared.settings.textColor)

        // Header: ‹ Back, the feature's colored badge and name (drag here to move), × Close.
        let headerY = h - barHeight - 4
        backButton.frame = NSRect(x: 8, y: headerY, width: barHeight, height: barHeight)
        closeButton.frame = NSRect(x: w - 8 - barHeight, y: headerY, width: barHeight, height: barHeight)
        // Leaves room on the right for × and the 🔊 buttons in Ask and Write.
        dragHandle.frame = NSRect(x: 44, y: headerY, width: max(0, w - 44 - 84), height: barHeight)
        badge.frame = NSRect(x: 0, y: (barHeight - 24) / 2, width: 24, height: 24)
        badgeIcon.frame = badge.bounds
        let titleH = headerTitle.intrinsicContentSize.height
        headerTitle.frame = NSRect(x: badge.isHidden ? 0 : 32, y: (barHeight - titleH) / 2,
                                   width: max(0, dragHandle.frame.width - 32), height: titleH)

        let bottomBar = controls.isHidden ? 0 : barHeight
        scroll.frame = NSRect(x: 8, y: 8 + bottomBar, width: w - 16, height: max(0, h - 16 - barHeight - bottomBar))
        controls.frame = NSRect(x: 0, y: 4, width: w, height: barHeight)
        grip.frame = NSRect(x: w - 14, y: 1, width: 13, height: 13)
        for panelView in [ask, write] as [NSView] where !panelView.isHidden {
            panelView.frame = NSRect(origin: .zero, size: size)
            panelView.needsLayout = true
        }
        panel.invalidateShadow()
    }

    // MARK: - Size, move, animation

    private func size(for feature: PopupAction) -> NSSize {
        if let saved = UserDefaults.standard.string(forKey: sizeKey(feature)) {
            let s = NSSizeFromString(saved)
            if s.width >= minSize.width && s.height >= minSize.height { return s }
        }
        return feature == .read ? contentSize : askSize
    }

    private func sizeKey(_ feature: PopupAction) -> String { "polaris.popupSize.\(feature.label)" }

    /// Resizes from the bottom-right grip, keeping the top-left corner where it is.
    private func resize(to size: NSSize) {
        let vf = panel.screen?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let old = panel.frame
        let w = min(max(size.width, minSize.width), vf.maxX - old.minX)
        let h = min(max(size.height, minSize.height), old.maxY - vf.minY)
        panel.setFrame(NSRect(x: old.minX, y: old.maxY - h, width: w, height: h), display: true)
        layoutFrames()
    }

    /// The next time this feature opens, it uses the size the user dragged it to.
    private func rememberSize() {
        guard let feature else { return }
        UserDefaults.standard.set(NSStringFromSize(panel.frame.size), forKey: sizeKey(feature))
    }

    private func fadeIn() {
        panel.alphaValue = 0
        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.15
            panel.animator().alphaValue = 1
        }
    }

    /// The circles appear one after another.
    private func popIn() {
        let views: [NSView] = (thumbnail.isHidden ? [] : [thumbnail]) + circles.map { $0.1 }
        for (i, v) in views.enumerated() {
            let finalAlpha: CGFloat = (v as? CircleButton).map { $0.isEnabled ? 1 : 0.35 } ?? 1
            v.alphaValue = 0
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.04 * Double(i)) {
                NSAnimationContext.runAnimationGroup { ctx in
                    ctx.duration = 0.18
                    v.animator().alphaValue = finalAlpha
                }
            }
        }
    }

    @objc private func backTapped() { onBack?() }
    @objc private func closeTapped() { onClose?() }

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
        panel.invalidateShadow()
    }
}

/// A colored circle with an icon and a short label under it, used in the feature menu.
/// Grows and glows a little on hover.
@MainActor
private final class CircleButton: NSView {
    static let labelHeight: CGFloat = 20
    /// Room around the circle so it can grow on hover.
    static let pad: CGFloat = 4

    static func cellSize(_ diameter: CGFloat) -> NSSize {
        NSSize(width: diameter + pad * 2, height: diameter + pad * 2 + labelHeight)
    }

    private let handler: () -> Void
    private let title: String
    private let color: NSColor
    private let glow = NSView()
    private let disc = NSView()
    private let button: FirstClickButton
    private let label: NSTextField

    init(action: PopupAction, diameter: CGFloat, handler: @escaping () -> Void) {
        self.handler = handler
        title = action.title
        color = action.color
        button = FirstClickButton(frame: .zero)
        label = NSTextField(labelWithString: action.label)
        super.init(frame: NSRect(origin: .zero, size: Self.cellSize(diameter)))
        toolTip = title

        let side = bounds.width
        glow.wantsLayer = true
        glow.layer?.cornerRadius = side / 2
        glow.layer?.backgroundColor = color.cgColor
        glow.layer?.shadowColor = color.cgColor
        glow.layer?.shadowRadius = 8
        glow.layer?.shadowOpacity = 0.9
        glow.layer?.shadowOffset = .zero
        glow.alphaValue = 0
        glow.frame = discFrame(hover: true)
        addSubview(glow)

        disc.wantsLayer = true
        disc.layer?.cornerRadius = side / 2
        disc.layer?.backgroundColor = color.cgColor
        disc.layer?.borderWidth = 1
        disc.layer?.borderColor = NSColor.white.withAlphaComponent(0.35).cgColor
        disc.frame = discFrame(hover: false)
        addSubview(disc)

        button.frame = disc.bounds
        button.autoresizingMask = [.width, .height]
        button.image = NSImage(systemSymbolName: action.symbol, accessibilityDescription: title)?
            .withSymbolConfiguration(.init(pointSize: 20, weight: .semibold))
        button.imagePosition = .imageOnly
        button.bezelStyle = .regularSquare
        button.isBordered = false
        button.contentTintColor = .white
        button.target = self
        button.action = #selector(tapped)
        disc.addSubview(button)

        // A small dark pill under the circle, so the label reads on any background.
        label.font = .systemFont(ofSize: 11, weight: .semibold)
        label.textColor = .white
        label.alignment = .center
        label.wantsLayer = true
        label.layer?.backgroundColor = NSColor.black.withAlphaComponent(0.6).cgColor
        label.layer?.cornerRadius = 8
        let labelW = min(bounds.width, label.intrinsicContentSize.width + 14)
        label.frame = NSRect(x: (bounds.width - labelW) / 2, y: 2, width: labelW, height: 16)
        addSubview(label)

        addTrackingArea(NSTrackingArea(rect: .zero, options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect],
                                       owner: self, userInfo: nil))
    }

    required init?(coder: NSCoder) { fatalError() }

    private func discFrame(hover: Bool) -> NSRect {
        let inset: CGFloat = hover ? 1 : Self.pad
        let side = bounds.width - inset * 2
        return NSRect(x: inset, y: Self.labelHeight + inset, width: side, height: side)
    }

    override func mouseEntered(with event: NSEvent) { setHover(true) }
    override func mouseExited(with event: NSEvent) { setHover(false) }

    private func setHover(_ on: Bool) {
        guard isEnabled else { return }
        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.12
            disc.animator().frame = discFrame(hover: on)
            glow.animator().alphaValue = on ? 0.55 : 0
        }
    }

    @objc private func tapped() { handler() }

    /// Dimmed and unclickable when off (Read and Ask need selected text).
    var isEnabled = true {
        didSet {
            button.isEnabled = isEnabled
            alphaValue = isEnabled ? 1 : 0.35
            toolTip = isEnabled ? title : "\(title) (select some text first)"
            if !isEnabled { setHoverOff() }
        }
    }

    private func setHoverOff() {
        disc.frame = discFrame(hover: false)
        glow.alphaValue = 0
    }
}

/// The screenshot in the menu; hovering shows it bigger.
@MainActor
private final class ThumbnailView: NSImageView {
    private var preview: NSPanel?

    init() {
        super.init(frame: .zero)
        imageScaling = .scaleProportionallyUpOrDown
        wantsLayer = true
        layer?.cornerRadius = 10
        layer?.masksToBounds = true
        layer?.borderWidth = 2
        layer?.borderColor = NSColor.white.withAlphaComponent(0.9).cgColor
        layer?.backgroundColor = NSColor.black.withAlphaComponent(0.25).cgColor
        toolTip = "Using this screenshot"
        addTrackingArea(NSTrackingArea(rect: .zero, options: [.mouseEnteredAndExited, .activeAlways, .inVisibleRect],
                                       owner: self, userInfo: nil))
    }

    required init?(coder: NSCoder) { fatalError() }

    override func mouseEntered(with event: NSEvent) { showPreview() }
    override func mouseExited(with event: NSEvent) { hidePreview() }

    private func showPreview() {
        guard let image, let window, preview == nil else { return }
        let maxSide: CGFloat = 340
        let scale = min(1, maxSide / max(image.size.width, image.size.height, 1))
        let size = NSSize(width: max(80, image.size.width * scale), height: max(60, image.size.height * scale))
        let here = window.convertToScreen(convert(bounds, to: nil))
        let vf = window.screen?.visibleFrame ?? .zero
        var origin = NSPoint(x: here.minX, y: here.maxY + 8)
        if origin.y + size.height > vf.maxY { origin.y = here.minY - 8 - size.height }
        origin.x = min(max(vf.minX, origin.x), vf.maxX - size.width)

        let p = NSPanel(contentRect: NSRect(origin: origin, size: size), styleMask: [.borderless, .nonactivatingPanel],
                        backing: .buffered, defer: false)
        p.isOpaque = false
        p.backgroundColor = .clear
        p.hasShadow = true
        p.ignoresMouseEvents = true
        let view = NSImageView(frame: NSRect(origin: .zero, size: size))
        view.image = image
        view.imageScaling = .scaleProportionallyUpOrDown
        view.wantsLayer = true
        view.layer?.cornerRadius = 12
        view.layer?.masksToBounds = true
        view.layer?.borderWidth = 2
        view.layer?.borderColor = NSColor.white.cgColor
        view.layer?.backgroundColor = NSColor.black.withAlphaComponent(0.6).cgColor
        p.contentView = view
        window.addChildWindow(p, ordered: .above)
        preview = p
    }

    func hidePreview() {
        guard let preview else { return }
        preview.parent?.removeChildWindow(preview)
        preview.orderOut(nil)
        self.preview = nil
    }
}

/// The header strip: dragging it moves the popup.
@MainActor
private final class DragHandle: NSView {
    override func hitTest(_ point: NSPoint) -> NSView? { frame.contains(point) ? self : nil }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
    override func mouseDown(with event: NSEvent) { window?.performDrag(with: event) }
}

/// The corner grip: dragging it resizes the popup.
@MainActor
private final class ResizeGrip: NSView {
    var onResize: ((NSSize) -> Void)?
    var onEnd: (() -> Void)?
    private var start: (mouse: NSPoint, size: NSSize)?

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
    override func resetCursorRects() { addCursorRect(bounds, cursor: .crosshair) }

    override func draw(_ dirtyRect: NSRect) {
        NSColor.secondaryLabelColor.withAlphaComponent(0.6).setStroke()
        for i in 0..<3 {
            let d = CGFloat(i) * 4 + 3
            let path = NSBezierPath()
            path.move(to: NSPoint(x: bounds.maxX - d, y: 1))
            path.line(to: NSPoint(x: bounds.maxX - 1, y: d))
            path.lineWidth = 1.2
            path.stroke()
        }
    }

    override func mouseDown(with event: NSEvent) {
        start = (NSEvent.mouseLocation, window?.frame.size ?? .zero)
    }

    override func mouseDragged(with event: NSEvent) {
        guard let start else { return }
        let now = NSEvent.mouseLocation
        onResize?(NSSize(width: start.size.width + (now.x - start.mouse.x),
                         height: start.size.height - (now.y - start.mouse.y)))
    }

    override func mouseUp(with event: NSEvent) {
        start = nil
        onEnd?()
    }
}

/// Reports clicks in the reader's text (a click leaves an empty selection where it landed).
private final class TextClickWatcher: NSObject, NSTextViewDelegate {
    var onClick: ((Int) -> Void)?

    func textViewDidChangeSelection(_ notification: Notification) {
        guard let tv = notification.object as? NSTextView, tv.selectedRange().length == 0,
              let type = NSApp.currentEvent?.type, type == .leftMouseDown || type == .leftMouseUp else { return }
        onClick?(tv.selectedRange().location)
    }
}

/// Responds to the first click even when the popup isn't the key window.
final class FirstClickButton: NSButton {
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}
