// Previous/next word arrows and play/pause for the reader.
import AppKit

@MainActor
final class ReaderControls: NSView {
    var onPrev: (() -> Void)?
    var onNext: (() -> Void)?
    var onPlayPause: (() -> Void)?

    private let playButton = NSButton()
    private var buttons: [NSButton] = []

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
    }

    required init?(coder: NSCoder) { fatalError() }

    /// Colors the buttons to match the popup's text color.
    func setTint(_ color: NSColor) {
        for b in buttons { b.contentTintColor = color }
    }

    func setPlaying(_ playing: Bool) {
        let name = playing ? "pause.fill" : "play.fill"
        playButton.image = NSImage(systemSymbolName: name, accessibilityDescription: playing ? "Pause" : "Play")
        playButton.toolTip = playing ? "Pause" : "Play"
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
