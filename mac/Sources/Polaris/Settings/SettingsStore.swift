// Holds the user's reading settings: fetched from the web API's /api/settings and cached on the Mac.
import Foundation

@MainActor
final class SettingsStore {
    static let shared = SettingsStore()
    private static let key = "polaris.readerSettings"

    private(set) var settings: ReaderSettings

    private init() {
        if ProcessInfo.processInfo.environment["POLARIS_TEST_SETTINGS"] != nil {
            settings = .testPreset
        } else if let data = UserDefaults.standard.data(forKey: Self.key),
           let saved = try? JSONDecoder().decode(ReaderSettings.self, from: data) {
            settings = saved
        } else {
            settings = .default
        }
    }

    private var testMode: Bool { ProcessInfo.processInfo.environment["POLARIS_TEST_SETTINGS"] != nil }

    private var lastRefresh: Date?

    /// Fetches the user's settings from the web app (no-op if not connected or in test mode).
    /// With `ifOlderThan`, skips the request if the last one was that many seconds ago or less.
    func refresh(ifOlderThan seconds: TimeInterval? = nil) async {
        guard !testMode, AccountLink.isConnected else { return }
        if let seconds, let lastRefresh, Date().timeIntervalSince(lastRefresh) < seconds { return }
        lastRefresh = Date()
        do {
            update(try await PolarisAPI.settings())
        } catch {
            print("⚠️  Couldn't load settings: \(error.localizedDescription)")
        }
    }

    /// Saves settings received from the web app.
    func update(_ new: ReaderSettings) {
        settings = new
        if let data = try? JSONEncoder().encode(new) { UserDefaults.standard.set(data, forKey: Self.key) }
    }
}
