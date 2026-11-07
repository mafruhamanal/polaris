// ReaderSettings model (font, size, spacing, voice, speed, level) matching the web app.
import AppKit

/// Same JSON shape as `ReaderSettings` in web/lib/settings.ts, which the web app's quiz fills in.
struct ReaderSettings: Codable, Equatable {
    /// "system", "serif", "rounded", "monospace", or an installed font's name.
    var fontFamily = "system"
    var fontSize: Double = 16
    /// Extra space between letters, as a fraction of the font size (0.05 = 5%).
    var letterSpacing: Double = 0
    /// Line height as a multiple of the normal height.
    var lineSpacing: Double = 1.4
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
        lineSpacing: 2.0,
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

    /// Text attributes for showing text in the popup with these settings.
    var textAttributes: [NSAttributedString.Key: Any] {
        let paragraph = NSMutableParagraphStyle()
        paragraph.lineHeightMultiple = CGFloat(lineSpacing)
        return [
            .font: font,
            .foregroundColor: NSColor.labelColor,
            .kern: CGFloat(letterSpacing * fontSize),
            .paragraphStyle: paragraph,
        ]
    }
}
