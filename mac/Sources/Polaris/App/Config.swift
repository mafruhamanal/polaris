// App configuration: web API address, selection limit, and gesture options.
import AppKit

enum Config {
    /// The web app (Ask, Simplify, Write, settings, Connect): the deployed site unless POLARIS_API_URL
    /// points somewhere else (e.g. http://localhost:3000 while working on the web app).
    static let apiBaseURL = URL(string: ProcessInfo.processInfo.environment["POLARIS_API_URL"]
        ?? "https://polaris-khaki-three.vercel.app")!
    static let maxSelectionChars = 20_000

    static let requireOptionKey = false
}
