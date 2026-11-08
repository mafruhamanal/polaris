// Calls the web API (ask, simplify, settings) with the device token.
import Foundation

struct AskResult: Decodable {
    let inScope: Bool
    let answer: String
    let fromText: Bool
    let evidence: [String]
    let suggestions: [String]
}

@MainActor
enum PolarisAPI {
    enum APIError: LocalizedError {
        case notConnected
        case server(String)

        var errorDescription: String? {
            switch self {
            case .notConnected: return "Connect your account first: click the ★ in the menu bar → Connect Account."
            case .server(let message): return message
            }
        }
    }

    static func ask(_ question: String, context: SelectionContext,
                    history: [(question: String, answer: String)] = []) async throws -> AskResult {
        struct Turn: Encodable { let question: String; let answer: String }
        struct Body: Encodable {
            let question: String
            let selection: String
            let before: String?
            let after: String?
            let pageTitle: String?
            let history: [Turn]
        }
        let body = Body(question: question, selection: context.selection, before: context.before,
                        after: context.after, pageTitle: context.pageTitle,
                        history: history.map { Turn(question: $0.question, answer: $0.answer) })
        let data = try await send("api/ask", method: "POST", body: try JSONEncoder().encode(body))
        return try JSONDecoder().decode(AskResult.self, from: data)
    }

    /// The selection rewritten at the user's reading level (POST /api/simplify, which also saves it).
    static func simplify(_ text: String, app: String?, title: String?) async throws -> String {
        struct Context: Encodable { let app: String?; let title: String? }
        struct Body: Encodable { let text: String; let mode = "simplify"; let context: Context }
        struct Response: Decodable { let text: String }
        let body = Body(text: text, context: Context(app: app, title: title))
        let data = try await send("api/simplify", method: "POST", body: try JSONEncoder().encode(body))
        return try JSONDecoder().decode(Response.self, from: data).text
    }

    static func settings() async throws -> ReaderSettings {
        try JSONDecoder().decode(ReaderSettings.self, from: try await send("api/settings"))
    }

    private static func send(_ path: String, method: String = "GET", body: Data? = nil) async throws -> Data {
        guard let token = AccountLink.token else { throw APIError.notConnected }
        var req = URLRequest(url: Config.apiBaseURL.appendingPathComponent(path))
        req.httpMethod = method
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = body
        }
        req.timeoutInterval = 30

        let (data, response) = try await URLSession.shared.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 401 { throw APIError.notConnected }
        guard (200..<300).contains(status) else {
            let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
            throw APIError.server(message ?? "Server error \(status)")
        }
        return data
    }
}
