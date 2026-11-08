// Handles polaris:// links: stores the device token in the Keychain and refreshes settings.
import AppKit
import Security

@MainActor
enum AccountLink {
    private static let service = "Polaris"
    private static let account = "deviceToken"

    /// The device token from the web app's /connect page, if connected. Read from the Keychain
    /// once (at launch) and kept in memory, so macOS never asks for it while the ★ menu is open.
    static var token: String? {
        if let cached { return cached.value }
        let value = readKeychain()
        cached = .init(value: value)
        return value
    }

    private struct Cached { let value: String? }
    private static var cached: Cached?

    private static func readKeychain() -> String? {
        var item: CFTypeRef?
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
        ]
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static var isConnected: Bool { token != nil }

    /// Handles polaris://connected?token=… . Returns true if it was a connect link.
    static func handle(_ url: URL) -> Bool {
        guard url.scheme == "polaris", url.host == "connected",
              let token = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                  .queryItems?.first(where: { $0.name == "token" })?.value,
              !token.isEmpty else { return false }
        save(token)
        return true
    }

    static func save(_ token: String) {
        disconnect()
        let item: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: Data(token.utf8),
        ]
        SecItemAdd(item as CFDictionary, nil)
        cached = .init(value: token)
    }

    static func disconnect() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
        cached = .init(value: nil)
    }

    /// Opens the web app's /connect page, which sends the browser back to polaris://connected.
    static func openConnectPage() {
        NSWorkspace.shared.open(Config.apiBaseURL.appendingPathComponent("connect"))
    }
}
