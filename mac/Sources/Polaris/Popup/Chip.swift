// Pill-shaped buttons in the user's reading font: outlined for suggestions, filled
// with the accent color for the main action (Simplify, Done, Save).
import AppKit

@MainActor
enum Chip {
    static func height(_ settings: ReaderSettings) -> CGFloat { settings.lineHeight + 10 }

    static func make(_ title: String, symbol: String? = nil, filled: Bool = false, settings: ReaderSettings,
                     target: AnyObject, action: Selector) -> FirstClickButton {
        let color = filled ? NSColor.white : settings.textColor
        let chip = FirstClickButton(title: "", target: target, action: action)
        chip.isBordered = false
        chip.cell?.wraps = true
        chip.cell?.lineBreakMode = .byWordWrapping
        if let symbol {
            chip.image = NSImage(systemSymbolName: symbol, accessibilityDescription: nil)?
                .withSymbolConfiguration(.init(pointSize: CGFloat(settings.fontSize) * 0.8, weight: .semibold))
            chip.imagePosition = .imageLeading
            chip.imageHugsTitle = true
            chip.contentTintColor = color
        }
        let styled = NSMutableAttributedString(attributedString: settings.styled(symbol == nil ? title : " " + title))
        let whole = NSRange(location: 0, length: styled.length)
        styled.removeAttribute(.paragraphStyle, range: whole)
        styled.addAttribute(.foregroundColor, value: color, range: whole)
        chip.attributedTitle = styled
        chip.wantsLayer = true
        chip.layer?.cornerRadius = height(settings) / 2
        if filled {
            chip.layer?.backgroundColor = NSColor.controlAccentColor.cgColor
        } else {
            chip.layer?.borderWidth = 1
            chip.layer?.borderColor = settings.textColor.withAlphaComponent(0.25).cgColor
            chip.layer?.backgroundColor = settings.textColor.withAlphaComponent(0.06).cgColor
        }
        return chip
    }

    /// Width that fits the chip's title (and icon) with padding.
    static func width(_ chip: NSButton) -> CGFloat { chip.fittingSize.width + 20 }
}
