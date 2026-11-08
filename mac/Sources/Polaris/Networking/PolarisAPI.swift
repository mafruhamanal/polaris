// Calls the web API (ask, simplify, write, catalogs, speech, settings) with the device token.
import Foundation

struct AskResult: Decodable {
    let inScope: Bool
    let answer: String
    let fromText: Bool
    let evidence: [String]
    let suggestions: [String]
}

/// A note written from what the user said (POST /api/write).
struct WriteResult: Decodable {
    let title: String
    let note: String
    /// An existing catalog's name, a suggested new one, or "".
    let catalog: String
}

/// ElevenLabs audio and when each word starts (POST /api/speak).
struct Speech: Decodable {
    struct Word: Decodable {
        /// Where the word starts in the text (UTF-16, like NSString).
        let offset: Int
        /// Seconds into the audio.
        let time: Double
    }
    let audio: String
    let words: [Word]
}

@MainActor
enum PolarisAPI {
    enum APIError: LocalizedError {
        case notConnected
        /// The server doesn't support this yet (501), e.g. no ElevenLabs key.
        case unavailable(String)
        case server(String)

        var errorDescription: String? {
            switch self {
            case .notConnected: return "Connect your account first: click the ★ in the menu bar → Connect Account."
            case .unavailable(let message), .server(let message): return message
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

    static func write(_ transcript: String, context: SelectionContext?) async throws -> WriteResult {
        struct Body: Encodable {
            let transcript: String
            let selection: String?
            let pageTitle: String?
        }
        let body = Body(transcript: transcript,
                        selection: context?.selection, pageTitle: context?.pageTitle)
        let data = try await send("api/write", method: "POST", body: try JSONEncoder().encode(body))
        return try JSONDecoder().decode(WriteResult.self, from: data)
    }

    /// Names of the user's catalogs, A–Z.
    static func catalogs() async throws -> [String] {
        struct Catalog: Decodable { let name: String }
        struct Response: Decodable { let catalogs: [Catalog] }
        return try JSONDecoder().decode(Response.self, from: try await send("api/catalogs")).catalogs.map(\.name)
    }

    /// Creates a catalog (or finds the existing one with that name); returns its name as saved.
    static func createCatalog(_ name: String) async throws -> String {
        struct Body: Encodable { let name: String }
        struct Catalog: Decodable { let name: String }
        let data = try await send("api/catalogs", method: "POST", body: try JSONEncoder().encode(Body(name: name)))
        return try JSONDecoder().decode(Catalog.self, from: data).name
    }

    /// Saves a Write note to Saved Responses, in the catalog named `catalog` (created if new).
    static func saveNote(title: String, note: String, transcript: String, catalog: String?,
                         app: String?, window: String?) async throws {
        struct Body: Encodable {
            let originalText: String
            let response: String
            let mode = "note"
            let title: String
            let catalogName: String?
            let sourceApp: String?
            let sourceWindow: String?
        }
        let body = Body(originalText: transcript, response: note, title: title, catalogName: catalog,
                        sourceApp: app, sourceWindow: window)
        _ = try await send("api/save", method: "POST", body: try JSONEncoder().encode(body))
    }

    /// `text` read by the ElevenLabs voice `voiceId`, with word timings.
    static func speak(_ text: String, voiceId: String) async throws -> Speech {
        struct Body: Encodable { let text: String; let voiceId: String }
        let data = try await send("api/speak", method: "POST", body: try JSONEncoder().encode(Body(text: text, voiceId: voiceId)))
        return try JSONDecoder().decode(Speech.self, from: data)
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
            if status == 501 { throw APIError.unavailable(message ?? "Not available") }
            throw APIError.server(message ?? "Server error \(status)")
        }
        return data
    }
}
