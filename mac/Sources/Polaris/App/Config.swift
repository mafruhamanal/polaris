// App configuration: API key, model, prompts, and gesture options.
import AppKit

enum Config {
    static let apiKey = ProcessInfo.processInfo.environment["GEMINI_API_KEY"] ?? ""
    static let model = ProcessInfo.processInfo.environment["GEMINI_MODEL"] ?? "gemini-3.6-flash"
    static let maxSelectionChars = 20_000
    static let explainPrompt = """
    You are an assistant the user summoned by circling their cursor over text they selected. \
    Explain what the text means and anything in it that may be hard to understand. \
    Be concise: a few short paragraphs at most. Reply in plain text with no Markdown formatting.
    """

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
