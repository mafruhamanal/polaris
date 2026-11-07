// App configuration: API key, model, prompt, and gesture options.
import AppKit

enum Config {
    static let apiKey = ProcessInfo.processInfo.environment["ANTHROPIC_API_KEY"] ?? ""
    static let model = ProcessInfo.processInfo.environment["CURSOR_AI_MODEL"] ?? "claude-sonnet-5-5"
    static let maxSelectionChars = 20_000
    static let systemPrompt = """
    You are an assistant the user summoned by circling their cursor over text they selected. \
    Figure out what is most useful (explain, summarize, define, translate, answer, or fix) and do it. \
    Be concise: a few short paragraphs at most. Reply in plain text with no Markdown formatting.
    """
    static let requireOptionKey = false
}
