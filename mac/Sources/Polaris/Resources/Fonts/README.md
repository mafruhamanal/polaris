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

## How the Mac app loads them

`Package.swift` copies this folder into the app (`resources: [.copy("Resources/Fonts")]`), and
`FontLoader` registers every .ttf/.otf here at launch, for Polaris only (nothing is installed
on the system). `ReaderSettings` then finds a font by its family name, e.g. `"Lexend"`.
To add a font, drop the file and its license here and add a row to the table above.

## Background colors (`background` field)

| Value | Background | Text |
|---|---|---|
| `white` | #FFFFFF | #1A1A1A |
| `cream` | #FBF5E6 | #1A1A1A |
| `dark` | #1E1E24 | #E8E6E3 |
