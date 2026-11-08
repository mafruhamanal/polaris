// Reads the text just before and after the selection, plus the window title, for Ask.
// Works in apps that expose their text through Accessibility (TextEdit, Notes, Mail, Pages…).
// Web pages in Safari/Chrome usually don't, so before/after are nil there.
import AppKit
import ApplicationServices

struct SelectionContext {
    let selection: String
    let before: String?
    let after: String?
    let pageTitle: String?
    /// Base64 JPEG when this came from a screenshot (then `selection` is the text recognized in it).
    var screenshot: String? = nil
}

@MainActor
enum ContextReader {
    static func read(selection: String, window: Int = 1200) -> SelectionContext {
        let app = NSWorkspace.shared.frontmostApplication
        let title = app.flatMap(windowTitle)
        guard let app, let el = focusedElement(app),
              let full = string(el, kAXValueAttribute),
              let range = selectedRange(el) else {
            return SelectionContext(selection: selection, before: nil, after: nil, pageTitle: title)
        }
        let ns = full as NSString
        let selStart = max(0, min(range.location, ns.length))
        let selEnd = max(selStart, min(range.location + range.length, ns.length))
        let start = max(0, selStart - window)
        let end = min(ns.length, selEnd + window)
        let before = ns.substring(with: NSRange(location: start, length: selStart - start))
        let after = ns.substring(with: NSRange(location: selEnd, length: end - selEnd))
        return SelectionContext(selection: selection,
                                before: before.isEmpty ? nil : before,
                                after: after.isEmpty ? nil : after,
                                pageTitle: title)
    }

    private static func focusedElement(_ app: NSRunningApplication) -> AXUIElement? {
        let appEl = AXUIElementCreateApplication(app.processIdentifier)
        AXUIElementSetMessagingTimeout(appEl, 0.5)
        var v: CFTypeRef?
        guard AXUIElementCopyAttributeValue(appEl, kAXFocusedUIElementAttribute as CFString, &v) == .success,
              let v, CFGetTypeID(v) == AXUIElementGetTypeID() else { return nil }
        return (v as! AXUIElement)
    }

    private static func string(_ el: AXUIElement, _ attr: String) -> String? {
        var v: CFTypeRef?
        guard AXUIElementCopyAttributeValue(el, attr as CFString, &v) == .success else { return nil }
        return v as? String
    }

    private static func selectedRange(_ el: AXUIElement) -> CFRange? {
        var v: CFTypeRef?
        guard AXUIElementCopyAttributeValue(el, kAXSelectedTextRangeAttribute as CFString, &v) == .success,
              let v, CFGetTypeID(v) == AXValueGetTypeID() else { return nil }
        var r = CFRange()
        return AXValueGetValue(v as! AXValue, .cfRange, &r) ? r : nil
    }

    private static func windowTitle(_ app: NSRunningApplication) -> String? {
        let appEl = AXUIElementCreateApplication(app.processIdentifier)
        AXUIElementSetMessagingTimeout(appEl, 0.5)
        var w: CFTypeRef?
        guard AXUIElementCopyAttributeValue(appEl, kAXFocusedWindowAttribute as CFString, &w) == .success,
              let w, CFGetTypeID(w) == AXUIElementGetTypeID() else { return nil }
        return string(w as! AXUIElement, kAXTitleAttribute)
    }
}
