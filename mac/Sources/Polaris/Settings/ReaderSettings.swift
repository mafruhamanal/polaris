// ReaderSettings model (font, size, spacing, background, voice, speed, level) matching the web app.
import AppKit

/// Same JSON shape as `ReaderSettings` in web/lib/settings.ts, which the web app's quiz fills in.
struct ReaderSettings: Codable, Equatable {
    /// "system", "serif", "rounded", "monospace", or an installed font's name.
    var fontFamily = "system"
    var fontSize: Double = 16
    /// Extra space between letters, as a fraction of the font size (0.05 = 5%).
    var letterSpacing: Double = 0
    /// Extra space between words, as a fraction of the font size (0.25 = a quarter of the size).
    var wordSpacing: Double = 0
    /// Line height as a multiple of the normal height.
    var lineSpacing: Double = 1.4
    /// Popup background as "#RRGGBB"; nil keeps the default translucent look.
    var background: String? = nil
    /// AVSpeechSynthesisVoice identifier; nil uses the system voice.
    var voice: String? = nil
    /// Speech speed multiplier (1.0 = normal).
    var readingSpeed: Double = 1.0
    /// Target level for simplified text: "simple", "standard", or "advanced".
    var readingLevel = "standard"

    static let `default` = ReaderSettings()

    /// A deliberately different look for testing the popup (run with POLARIS_TEST_SETTINGS=1).
    static let testPreset = ReaderSettings(
        fontFamily: "serif",
        fontSize: 22,
        letterSpacing: 0.08,
        wordSpacing: 0.3,
        lineSpacing: 2.0,
        background: "#FFF5DC",
        voice: "com.apple.voice.super-compact.en-GB.Daniel",
        readingSpeed: 0.7,
        readingLevel: "simple"
    )

    var font: NSFont {
        let size = CGFloat(fontSize)
        switch fontFamily {
        case "system": return .systemFont(ofSize: size)
        case "monospace": return .monospacedSystemFont(ofSize: size, weight: .regular)
        case "serif", "rounded":
            let base = NSFont.systemFont(ofSize: size)
            let design: NSFontDescriptor.SystemDesign = fontFamily == "serif" ? .serif : .rounded
            return base.fontDescriptor.withDesign(design).flatMap { NSFont(descriptor: $0, size: size) } ?? base
        default: return NSFont(name: fontFamily, size: size) ?? .systemFont(ofSize: size)
        }
    }

    var backgroundColor: NSColor? { background.flatMap(NSColor.init(hex:)) }

    /// Black or white text, whichever reads better on the chosen background.
    var textColor: NSColor {
        guard let bg = backgroundColor?.usingColorSpace(.sRGB) else { return .labelColor }
        let luminance = 0.2126 * bg.redComponent + 0.7152 * bg.greenComponent + 0.0722 * bg.blueComponent
        return luminance > 0.5 ? .black : .white
    }

    /// Text attributes for showing text in the popup with these settings.
    var textAttributes: [NSAttributedString.Key: Any] {
        let paragraph = NSMutableParagraphStyle()
        paragraph.lineHeightMultiple = CGFloat(lineSpacing)
        return [
            .font: font,
            .foregroundColor: textColor,
            .kern: CGFloat(letterSpacing * fontSize),
            .paragraphStyle: paragraph,
        ]
    }

    /// `s` styled with these settings, including extra space after each space character.
    func styled(_ s: String) -> NSAttributedString {
        let result = NSMutableAttributedString(string: s, attributes: textAttributes)
        guard wordSpacing > 0 else { return result }
        let spaceKern = CGFloat((letterSpacing + wordSpacing) * fontSize)
        let ns = s as NSString
        var i = 0
        while i < ns.length {
            let r = ns.rangeOfCharacter(from: .whitespaces, options: [], range: NSRange(location: i, length: ns.length - i))
            if r.location == NSNotFound { break }
            result.addAttribute(.kern, value: spaceKern, range: r)
            i = NSMaxRange(r)
        }
        return result
    }
}

private extension NSColor {
    /// Parses "#RRGGBB" (the leading # is optional).
    convenience init?(hex: String) {
        let digits = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        guard digits.count == 6, let value = UInt32(digits, radix: 16) else { return nil }
        self.init(srgbRed: CGFloat((value >> 16) & 0xFF) / 255,
                  green: CGFloat((value >> 8) & 0xFF) / 255,
                  blue: CGFloat(value & 0xFF) / 255, alpha: 1)
    }
}
