// Registers the fonts bundled in Resources/Fonts so the popup can use them by family name.
import CoreText
import Foundation

enum FontLoader {
    static func registerBundledFonts() {
        // Polaris.app keeps them in Contents/Resources/Fonts; `swift run` uses the SwiftPM bundle.
        guard let dir = Bundle.main.url(forResource: "Fonts", withExtension: nil)
                ?? Bundle.module.url(forResource: "Fonts", withExtension: nil),
              let files = try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)
        else {
            print("⚠️  Bundled fonts not found.")
            return
        }
        for url in files where ["ttf", "otf"].contains(url.pathExtension.lowercased()) {
            var error: Unmanaged<CFError>?
            if !CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error) {
                print("⚠️  Couldn't load font \(url.lastPathComponent): \(error?.takeRetainedValue().localizedDescription ?? "unknown error")")
            }
        }
    }
}
