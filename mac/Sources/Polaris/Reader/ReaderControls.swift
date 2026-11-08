// Previous/next word arrows and play/pause for the reader, plus a spinner and "Preparing
// voice…" while the voice loads.
import AppKit

@MainActor
final class ReaderControls: NSView {
    var onPrev: (() -> Void)?
    var onNext: (() -> Void)?
    var onPlayPause: (() -> Void)?

    private let playButton = NSButton()
    private var buttons: [NSButton] = []
    private let spinner = Spinner()
    private let status = NSTextField(labelWithString: "")
    private var playing = false
    private var loading = false
    private var almostReady: Timer?

    override init(frame: NSRect) {
        super.init(frame: frame)
        let prev = Self.iconButton("backward.fill", "Previous word", #selector(prevTapped), self)
        let next = Self.iconButton("forward.fill", "Next word", #selector(nextTapped), self)
        Self.style(playButton, "play.fill", "Play", #selector(playTapped), self)

        buttons = [prev, playButton, next]
        let stack = NSStackView(views: buttons)
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: centerYAnchor),
        ])
        status.lineBreakMode = .byTruncatingTail
        status.isHidden = true
        addSubview(status)
    }

    /// The status sits left of the buttons (they're centered, about 108pt wide).
    override func layout() {
        super.layout()
        let h = status.intrinsicContentSize.height
        status.frame = NSRect(x: 12, y: (bounds.height - h) / 2, width: max(0, bounds.midX - 66 - 12), height: h)
    }

    required init?(coder: NSCoder) { fatalError() }

    /// Colors the buttons to match the popup's text color.
    func setTint(_ color: NSColor) {
        for b in buttons { b.contentTintColor = color }
        status.textColor = color.withAlphaComponent(0.7)
    }

    func setPlaying(_ playing: Bool) {
        self.playing = playing
        guard !loading else { return }
        let name = playing ? "pause.fill" : "play.fill"
        playButton.image = NSImage(systemSymbolName: name, accessibilityDescription: playing ? "Pause" : "Play")
        playButton.toolTip = playing ? "Pause" : "Play"
    }

    /// Spinner instead of the play icon, and "Preparing voice…" (then "Almost ready…").
    func setLoading(_ loading: Bool) {
        self.loading = loading
        almostReady?.invalidate()
        almostReady = nil
        if loading {
            playButton.image = nil
            playButton.toolTip = "Cancel"
            spinner.show(in: playButton)
            showStatus("Preparing voice…")
            let timer = Timer(timeInterval: 3, repeats: false) { [weak self] _ in
                Task { @MainActor in if self?.loading == true { self?.showStatus("Almost ready…") } }
            }
            RunLoop.main.add(timer, forMode: .common)
            almostReady = timer
        } else {
            spinner.hide()
            status.isHidden = true
            setPlaying(playing)
        }
    }

    private func showStatus(_ text: String) {
        let size: CGFloat = 13
        let font = NSFont(descriptor: SettingsStore.shared.settings.font.fontDescriptor, size: size) ?? .systemFont(ofSize: size)
        status.font = font
        status.stringValue = text
        status.isHidden = false
        needsLayout = true
    }

    private static func iconButton(_ symbol: String, _ tip: String, _ action: Selector, _ target: AnyObject) -> NSButton {
        let b = NSButton()
        style(b, symbol, tip, action, target)
        return b
    }

    private static func style(_ b: NSButton, _ symbol: String, _ tip: String, _ action: Selector, _ target: AnyObject) {
        b.image = NSImage(systemSymbolName: symbol, accessibilityDescription: tip)
        b.toolTip = tip
        b.bezelStyle = .regularSquare
        b.isBordered = false
        b.target = target
        b.action = action
        b.widthAnchor.constraint(equalToConstant: 28).isActive = true
    }

    @objc private func prevTapped() { onPrev?() }
    @objc private func nextTapped() { onNext?() }
    @objc private func playTapped() { onPlayPause?() }
}
