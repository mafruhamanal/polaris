// Floating popup near the cursor that shows the response.
import AppKit

final class FloatingPanel: NSPanel {
    override var canBecomeKey: Bool { true }
}

@MainActor
final class Popup {
    private let size = NSSize(width: 400, height: 280)
    private let panel: FloatingPanel
    private let textView: NSTextView
    private(set) var text = ""

    var isVisible: Bool { panel.isVisible }

    init() {
        let rect = NSRect(origin: .zero, size: size)
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

        let scroll = NSScrollView(frame: rect.insetBy(dx: 8, dy: 8))
        scroll.hasVerticalScroller = true
        scroll.drawsBackground = false
        scroll.autoresizingMask = [.width, .height]

        textView = NSTextView(frame: scroll.contentView.bounds)
        textView.isEditable = false
        textView.isSelectable = true
        textView.drawsBackground = false
        textView.font = .systemFont(ofSize: 13)
        textView.textColor = .labelColor
        textView.textContainerInset = NSSize(width: 4, height: 4)
        textView.minSize = .zero
        textView.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: .greatestFiniteMagnitude)
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.autoresizingMask = [.width]
        textView.textContainer?.widthTracksTextView = true

        scroll.documentView = textView
        effect.addSubview(scroll)
        panel.contentView = effect
    }

    func show(near p: NSPoint) {
        let screen = NSScreen.screens.first { NSMouseInRect(p, $0.frame, false) } ?? NSScreen.main
        let vf = screen?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let w = size.width, h = size.height

        var x = p.x + 18
        var y = p.y - h - 18
        if x + w > vf.maxX { x = p.x - w - 18 }
        if y < vf.minY { y = p.y + 18 }
        x = max(vf.minX, min(x, vf.maxX - w))
        y = max(vf.minY, min(y, vf.maxY - h))

        panel.setFrameOrigin(NSPoint(x: x, y: y))
        panel.orderFrontRegardless()
    }

    func setText(_ s: String) {
        text = s
        textView.string = s
    }

    func append(_ s: String) {
        text += s
        textView.string = text
        textView.scrollToEndOfDocument(nil)
    }

    func hide() { panel.orderOut(nil) }
}
