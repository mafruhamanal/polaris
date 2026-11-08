// A small spinner shown inside a play/speak button while the voice is getting ready. Clicks go
// through to the button, so pressing it again still cancels.
import AppKit

final class Spinner: NSProgressIndicator {
    override init(frame: NSRect) {
        super.init(frame: frame)
        style = .spinning
        controlSize = .regular
        isDisplayedWhenStopped = false
    }

    required init?(coder: NSCoder) { fatalError() }

    override func hitTest(_ point: NSPoint) -> NSView? { nil }

    /// Spins in the middle of `button` (whose icon the caller hides meanwhile).
    func show(in button: NSView) {
        if superview !== button { button.addSubview(self) }
        let side = min(20, button.bounds.width, button.bounds.height)
        frame = NSRect(x: (button.bounds.width - side) / 2, y: (button.bounds.height - side) / 2, width: side, height: side)
        startAnimation(nil)
    }

    func hide() { stopAnimation(nil) }
}
