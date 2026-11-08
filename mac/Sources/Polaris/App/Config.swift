// App configuration: web API address, selection limit, and gesture options.
import AppKit

enum Config {
    /// The web app (Ask, Simplify, settings, Connect). Set POLARIS_API_URL to the Vercel URL once deployed.
    static let apiBaseURL = URL(string: ProcessInfo.processInfo.environment["POLARIS_API_URL"] ?? "http://localhost:3000")!
    static let maxSelectionChars = 20_000

    static let requireOptionKey = false
}
