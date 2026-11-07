// Holds the user's reading settings, cached on the Mac (later: fetched from the web API's /api/settings).
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

    /// Saves settings received from the web app.
    func update(_ new: ReaderSettings) {
        settings = new
        if let data = try? JSONEncoder().encode(new) { UserDefaults.standard.set(data, forKey: Self.key) }
    }
}
