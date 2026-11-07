// Streams Gemini responses for Simplify (switch to the web API later).
import Foundation

@MainActor
enum AI {
    struct APIError: LocalizedError {
        let message: String
        var errorDescription: String? { message }
    }

    static func stream(_ text: String, system: String, onText: (String) -> Void) async throws {
        guard !Config.apiKey.isEmpty else {
            throw APIError(message: "Simplify needs a Gemini key: set GEMINI_API_KEY (see the README).")
        }
        let url = URL(string: "https://generativelanguage.googleapis.com/v1beta/models/\(Config.model):streamGenerateContent?alt=sse")!
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue(Config.apiKey, forHTTPHeaderField: "x-goog-api-key")
        req.setValue("application/json", forHTTPHeaderField: "content-type")

        let body: [String: Any] = [
            "system_instruction": ["parts": [["text": system]]],
            "contents": [["role": "user", "parts": [["text": "Selected text:\n\n\(text)"]]]],
        ]
        req.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (bytes, response) = try await URLSession.shared.bytes(for: req)

        if let http = response as? HTTPURLResponse, http.statusCode != 200 {
            var errBody = ""
            for try await line in bytes.lines { errBody += line }
            let msg = ((try? JSONSerialization.jsonObject(with: Data(errBody.utf8)) as? [String: Any])?["error"]
                as? [String: Any])?["message"] as? String ?? errBody
            throw APIError(message: "API error \(http.statusCode): \(msg)")
        }

        for try await line in bytes.lines {
            try Task.checkCancellation()
            guard line.hasPrefix("data:") else { continue }
            let payload = line.dropFirst(5).trimmingCharacters(in: .whitespaces)
            guard let data = payload.data(using: .utf8),
                  let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { continue }

            if let reason = (obj["promptFeedback"] as? [String: Any])?["blockReason"] as? String {
                throw APIError(message: "Request blocked (\(reason)).")
            }
            let candidate = (obj["candidates"] as? [[String: Any]])?.first
            let parts = (candidate?["content"] as? [String: Any])?["parts"] as? [[String: Any]] ?? []
            for part in parts where part["thought"] as? Bool != true {
                if let t = part["text"] as? String { onText(t) }
            }
        }
    }
}
