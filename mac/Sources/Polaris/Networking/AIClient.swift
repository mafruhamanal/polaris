// Streams AI responses for the selected text (switch to the web API's /api/explain later).
import Foundation

@MainActor
enum Claude {
    struct APIError: LocalizedError {
        let message: String
        var errorDescription: String? { message }
    }

    static func stream(_ text: String, onText: (String) -> Void) async throws {
        var req = URLRequest(url: URL(string: "https://api.anthropic.com/v1/messages")!)
        req.httpMethod = "POST"
        req.setValue(Config.apiKey, forHTTPHeaderField: "x-api-key")
        req.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        req.setValue("application/json", forHTTPHeaderField: "content-type")

        let body: [String: Any] = [
            "model": Config.model,
            "max_tokens": 1024,
            "stream": true,
            "system": Config.systemPrompt,
            "messages": [["role": "user", "content": "Selected text:\n\n\(text)"]],
        ]
        req.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (bytes, response) = try await URLSession.shared.bytes(for: req)

        if let http = response as? HTTPURLResponse, http.statusCode != 200 {
            var errBody = ""
            for try await line in bytes.lines { errBody += line }
            throw APIError(message: "API error \(http.statusCode): \(errBody)")
        }

        for try await line in bytes.lines {
            try Task.checkCancellation()
            guard line.hasPrefix("data:") else { continue }
            let payload = line.dropFirst(5).trimmingCharacters(in: .whitespaces)
            guard let data = payload.data(using: .utf8),
                  let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let type = obj["type"] as? String else { continue }

            if type == "content_block_delta",
               let delta = obj["delta"] as? [String: Any],
               let t = delta["text"] as? String {
                onText(t)
            } else if type == "error" {
                let msg = (obj["error"] as? [String: Any])?["message"] as? String ?? payload
                throw APIError(message: msg)
            }
        }
    }
}
