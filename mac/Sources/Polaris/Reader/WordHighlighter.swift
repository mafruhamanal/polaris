// Highlights the current word in the popup as it is read aloud, and marks where reading will
// start (a softly pulsing underline) while the voice is getting ready.
import AppKit

@MainActor
final class WordHighlighter {
    let textView: NSTextView
    private var pulse: Timer?
    private var pulseOn = false

    init(textView: NSTextView) {
        self.textView = textView
    }

    func highlight(_ range: NSRange?) {
        clear()
        guard let lm = textView.layoutManager, let range, fits(range) else { return }
        lm.addTemporaryAttribute(.backgroundColor, value: NSColor.findHighlightColor, forCharacterRange: range)
        lm.addTemporaryAttribute(.foregroundColor, value: NSColor.black, forCharacterRange: range)
        textView.scrollRangeToVisible(range)
    }

    /// Marks `range` as where reading will start, pulsing until highlight() or clear(); nil clears it.
    func showPending(_ range: NSRange?) {
        clear()
        guard let range, fits(range) else { return }
        textView.scrollRangeToVisible(range)
        pulseOn = true
        drawPending(range)
        let timer = Timer(timeInterval: 0.6, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self else { return }
                self.pulseOn.toggle()
                self.drawPending(range)
            }
        }
        RunLoop.main.add(timer, forMode: .common)
        pulse = timer
    }

    func clear() {
        pulse?.invalidate()
        pulse = nil
        guard let lm = textView.layoutManager else { return }
        let all = NSRange(location: 0, length: (textView.string as NSString).length)
        for key in [NSAttributedString.Key.backgroundColor, .foregroundColor, .underlineStyle, .underlineColor] {
            lm.removeTemporaryAttribute(key, forCharacterRange: all)
        }
    }

    private func drawPending(_ range: NSRange) {
        guard let lm = textView.layoutManager, fits(range) else { return }
        let color = NSColor.findHighlightColor.withAlphaComponent(pulseOn ? 0.45 : 0.15)
        lm.addTemporaryAttribute(.backgroundColor, value: color, forCharacterRange: range)
        lm.addTemporaryAttribute(.underlineStyle, value: NSUnderlineStyle.thick.rawValue, forCharacterRange: range)
        lm.addTemporaryAttribute(.underlineColor, value: NSColor.findHighlightColor, forCharacterRange: range)
    }

    private func fits(_ range: NSRange) -> Bool {
        NSMaxRange(range) <= (textView.string as NSString).length
    }
}
