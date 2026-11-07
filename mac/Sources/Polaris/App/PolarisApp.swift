// App entry point: launches Polaris as a menu bar app with no Dock icon.
import AppKit

@main
struct PolarisApp {
    @MainActor static func main() {
        let app = NSApplication.shared
        let delegate = AppDelegate()
        app.delegate = delegate
        app.setActivationPolicy(.accessory)
        withExtendedLifetime(delegate) { app.run() }
    }
}
