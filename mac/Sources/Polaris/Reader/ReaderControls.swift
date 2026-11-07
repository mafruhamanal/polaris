// Previous/next word arrows, play/pause, and reading speed control.
import AppKit

@MainActor
final class ReaderControls: NSView {
    var onPrev: (() -> Void)?
    var onNext: (() -> Void)?
    var onPlayPause: (() -> Void)?
    var onRate: ((Float) -> Void)?

    private let playButton = NSButton()
    private let slider = NSSlider()
    private let rateLabel = NSTextField(labelWithString: "")

    init(rate: Float) {
        super.init(frame: .zero)
        let prev = Self.iconButton("backward.fill", "Previous word", #selector(prevTapped), self)
        let next = Self.iconButton("forward.fill", "Next word", #selector(nextTapped), self)
        Self.style(playButton, "play.fill", "Play", #selector(playTapped), self)

        slider.minValue = Double(SpeechReader.minRate)
        slider.maxValue = Double(SpeechReader.maxRate)
        slider.doubleValue = Double(rate)
        slider.controlSize = .small
        slider.isContinuous = false
        slider.target = self
        slider.action = #selector(rateChanged)
        slider.toolTip = "Reading speed"
        rateLabel.font = .monospacedDigitSystemFont(ofSize: 11, weight: .regular)
        rateLabel.textColor = .secondaryLabelColor
        updateRateLabel()

        let stack = NSStackView(views: [prev, playButton, next, slider, rateLabel])
        stack.spacing = 6
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            stack.centerYAnchor.constraint(equalTo: centerYAnchor),
            rateLabel.widthAnchor.constraint(equalToConstant: 36),
        ])
    }

    required init?(coder: NSCoder) { fatalError() }

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
        b.widthAnchor.constraint(equalToConstant: 24).isActive = true
    }

    private func updateRateLabel() {
        rateLabel.stringValue = String(format: "%.1f×", slider.doubleValue)
    }

    @objc private func prevTapped() { onPrev?() }
    @objc private func nextTapped() { onNext?() }
    @objc private func playTapped() { onPlayPause?() }
    @objc private func rateChanged() {
        slider.doubleValue = (slider.doubleValue * 10).rounded() / 10
        updateRateLabel()
        onRate?(Float(slider.doubleValue))
    }
}
