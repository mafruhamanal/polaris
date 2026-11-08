// ReaderSettings model (font, size, spacing, background, voice, speed, level) matching the web app.
import AppKit

/// Same JSON shape as `SavedSettings` in web/lib/settings.ts (what GET /api/settings returns).
struct ReaderSettings: Codable, Equatable {
    /// One of `fonts` (the same fonts the web quiz and settings offer).
    var fontFamily = ReaderSettings.defaultFont
    var fontSize: Double = 16
    /// Extra space between letters, as a fraction of the font size (0.05 = 5%).
    var letterSpacing: Double = 0
    /// Extra space between words, as a fraction of the font size (0.25 = a quarter of the size).
    var wordSpacing: Double = 0
    /// Line height as a multiple of the normal height.
    var lineSpacing: Double = 1.4
    /// "white", "cream", or "dark" (colors in Resources/Fonts/README.md and the web's BACKGROUNDS).
    var background = "white"
    /// AVSpeechSynthesisVoice identifier; nil uses the system voice.
    var voice: String? = nil
    /// Speech speed multiplier (1.0 = normal).
    var readingSpeed: Double = 1.0
    /// Target level for simplified text: "simple", "standard", or "advanced".
    var readingLevel = "standard"

    static let `default` = ReaderSettings()

    /// The only fonts, same as FONTS in web/lib/settings.ts. Anything else saved falls back to `defaultFont`.
    static let fonts = ["Atkinson Hyperlegible", "Lexend", "Verdana", "OpenDyslexic"]
    static let defaultFont = "Atkinson Hyperlegible"

    /// Background and text colors for each `background` value.
    static let backgrounds: [String: (bg: String, text: String)] = [
        "white": ("#FFFFFF", "#1A1A1A"),
        "cream": ("#FBF5E6", "#1A1A1A"),
        "dark": ("#1E1E24", "#E8E6E3"),
    ]

    /// A deliberately different look for testing the popup (run with POLARIS_TEST_SETTINGS=1).
    static let testPreset = ReaderSettings(
        fontFamily: "Lexend",
        fontSize: 22,
        letterSpacing: 0.08,
        wordSpacing: 0.3,
        lineSpacing: 2.0,
        background: "cream",
        voice: "com.apple.voice.super-compact.en-GB.Daniel",
        readingSpeed: 0.7,
        readingLevel: "simple"
    )

    init(fontFamily: String = ReaderSettings.defaultFont, fontSize: Double = 16, letterSpacing: Double = 0, wordSpacing: Double = 0,
         lineSpacing: Double = 1.4, background: String = "white", voice: String? = nil,
         readingSpeed: Double = 1.0, readingLevel: String = "standard") {
        self.fontFamily = Self.fonts.contains(fontFamily) ? fontFamily : Self.defaultFont
        self.fontSize = fontSize
        self.letterSpacing = letterSpacing
        self.wordSpacing = wordSpacing
        self.lineSpacing = lineSpacing
        self.background = background
        self.voice = voice
        self.readingSpeed = readingSpeed
        self.readingLevel = readingLevel
    }

    /// Any missing field gets its default (the web doesn't send `wordSpacing` yet).
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let d = ReaderSettings.default
        let saved = try c.decodeIfPresent(String.self, forKey: .fontFamily)
        fontFamily = saved.flatMap { Self.fonts.contains($0) ? $0 : nil } ?? d.fontFamily
        fontSize = try c.decodeIfPresent(Double.self, forKey: .fontSize) ?? d.fontSize
        letterSpacing = try c.decodeIfPresent(Double.self, forKey: .letterSpacing) ?? d.letterSpacing
        wordSpacing = try c.decodeIfPresent(Double.self, forKey: .wordSpacing) ?? d.wordSpacing
        lineSpacing = try c.decodeIfPresent(Double.self, forKey: .lineSpacing) ?? d.lineSpacing
        background = try c.decodeIfPresent(String.self, forKey: .background) ?? d.background
        voice = try c.decodeIfPresent(String.self, forKey: .voice)
        readingSpeed = try c.decodeIfPresent(Double.self, forKey: .readingSpeed) ?? d.readingSpeed
        readingLevel = try c.decodeIfPresent(String.self, forKey: .readingLevel) ?? d.readingLevel
    }

    var font: NSFont {
        let size = CGFloat(fontSize)
        // The bundled fonts are registered by FontLoader at launch; Verdana comes with macOS.
        return NSFontManager.shared.font(withFamily: fontFamily, traits: [], weight: 5, size: size)
            ?? NSFont(name: fontFamily, size: size) ?? .systemFont(ofSize: size)
    }

    /// Height of one line of text in the reading font.
    var lineHeight: CGFloat {
        let f = font
        return ceil(f.ascender - f.descender + f.leading)
    }

    private var colors: (bg: String, text: String) { Self.backgrounds[background] ?? Self.backgrounds["white"]! }
    var backgroundColor: NSColor { NSColor(hex: colors.bg) ?? .white }
    var textColor: NSColor { NSColor(hex: colors.text) ?? .black }
    /// Light or dark controls (text boxes, buttons) to match the background.
    var appearance: NSAppearance? { NSAppearance(named: background == "dark" ? .darkAqua : .aqua) }

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
