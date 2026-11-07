// Highlights the current word in the popup as it is read aloud.
import AppKit

@MainActor
struct WordHighlighter {
    let textView: NSTextView

    func highlight(_ range: NSRange?) {
        clear()
        guard let lm = textView.layoutManager, let range,
              NSMaxRange(range) <= (textView.string as NSString).length else { return }
        lm.addTemporaryAttribute(.backgroundColor, value: NSColor.findHighlightColor, forCharacterRange: range)
        lm.addTemporaryAttribute(.foregroundColor, value: NSColor.black, forCharacterRange: range)
        textView.scrollRangeToVisible(range)
    }

    func clear() {
        guard let lm = textView.layoutManager else { return }
        let all = NSRange(location: 0, length: (textView.string as NSString).length)
        lm.removeTemporaryAttribute(.backgroundColor, forCharacterRange: all)
        lm.removeTemporaryAttribute(.foregroundColor, forCharacterRange: all)
    }
}
