// App configuration: API key, model, web API address, prompts, and gesture options.
import AppKit

enum Config {
    static let apiKey = ProcessInfo.processInfo.environment["GEMINI_API_KEY"] ?? ""
    static let model = ProcessInfo.processInfo.environment["GEMINI_MODEL"] ?? "gemini-3.6-flash"
    /// The web app (Ask, settings, Connect). Set POLARIS_API_URL to the Vercel URL once deployed.
    static let apiBaseURL = URL(string: ProcessInfo.processInfo.environment["POLARIS_API_URL"] ?? "http://localhost:3000")!
    static let maxSelectionChars = 20_000
    /// Rewrites the selection at the user's reading level ("simple", "standard", or "advanced").
    static func simplifyPrompt(level: String) -> String {
        let audience: String
        switch level {
        case "simple": audience = "a reader at about a 3rd-grade level: very short sentences and everyday words"
        case "advanced": audience = "an adult reader: keep the detail, just make it clearer and better organized"
        default: audience = "a reader at about a 6th-grade level: short sentences and common words"
        }
        return """
        Rewrite the user's text so it is easier to read, for \(audience). \
        Keep every important fact and the original meaning. Do not add commentary or say what you changed. \
        Reply in plain text with no Markdown formatting.
        """
    }

    static let requireOptionKey = false
}
