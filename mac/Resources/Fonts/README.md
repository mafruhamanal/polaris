# Fonts for the reading view

These are the fonts the web quiz offers. The quiz saves the font's **family name** in
`fontFamily`, so the Mac app needs these files loaded to match it. Verdana comes with macOS.

| File | Family name (`fontFamily`) | License |
|---|---|---|
| AtkinsonHyperlegible-Regular.ttf, -Bold.ttf | `Atkinson Hyperlegible` | SIL OFL 1.1 (AtkinsonHyperlegible-OFL.txt) |
| Lexend-VariableFont_wght.ttf (all weights) | `Lexend` | SIL OFL 1.1 (Lexend-OFL.txt) |
| OpenDyslexic-Regular.otf, -Bold.otf | `OpenDyslexic` | SIL OFL 1.1 (OpenDyslexic-OFL.txt) |

Sources: github.com/google/fonts (Atkinson Hyperlegible, Lexend) and
github.com/antijingoist/opendyslexic (OpenDyslexic). Keep the OFL files with the fonts.

## Not wired up yet

`Package.swift` doesn't include any resources, and this folder sits outside the target's
`Sources/Polaris` path, so these files aren't in the app yet. The Mac app needs to:
1. Bundle them (move the folder under `Sources/Polaris/` and add
   `resources: [.copy("Resources/Fonts")]` to the target, or point the target at them another way).
2. Register them at launch, e.g. `CTFontManagerRegisterFontsForURL(url, .process, nil)` for each file.
3. Then `NSFont(name: "Lexend", size: 18)` etc. will find them.

## Background colors (`background` field)

| Value | Background | Text |
|---|---|---|
| `white` | #FFFFFF | #1A1A1A |
| `cream` | #FBF5E6 | #1A1A1A |
| `dark` | #1E1E24 | #E8E6E3 |
