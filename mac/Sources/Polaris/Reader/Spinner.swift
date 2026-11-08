// A small spinner shown inside a play/speak button while the voice is getting ready. Clicks go
// through to the button, so pressing it again still cancels.
import AppKit

final class Spinner: NSProgressIndicator {
    override init(frame: NSRect) {
        super.init(frame: frame)
        style = .spinning
        controlSize = .small
        isDisplayedWhenStopped = false
    }

    required init?(coder: NSCoder) { fatalError() }

    override func hitTest(_ point: NSPoint) -> NSView? { nil }

    /// Spins in the middle of `button` (whose icon the caller hides meanwhile).
    func show(in button: NSView) {
        if superview !== button { button.addSubview(self) }
        frame = NSRect(x: (button.bounds.width - 16) / 2, y: (button.bounds.height - 16) / 2, width: 16, height: 16)
        startAnimation(nil)
    }

    func hide() { stopAnimation(nil) }
}
