// Starts the app: permissions, event monitors, and the circle → selection → popup flow.
import AppKit
import ApplicationServices

@MainActor final class AppDelegate: NSObject, NSApplicationDelegate {
    private let detector = CircleDetector()
    private lazy var popup = Popup()
    private var currentTask: Task<Void, Never>?
    private var monitors: [Any] = []

    func applicationDidFinishLaunching(_ notification: Notification) {
        guard !Config.apiKey.isEmpty else {
            print("❌ Set ANTHROPIC_API_KEY first:  export ANTHROPIC_API_KEY=sk-ant-...")
            exit(1)
        }

        let opts = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        if !AXIsProcessTrustedWithOptions(opts) {
            print("""
            ⚠️  Accessibility permission needed.
               System Settings → Privacy & Security → Accessibility → enable your terminal app
               (Terminal, iTerm, VS Code…), then quit and re-run this program.
            """)
        }

        if let m = NSEvent.addGlobalMonitorForEvents(matching: .mouseMoved, handler: { [weak self] event in
            if Config.requireOptionKey && !event.modifierFlags.contains(.option) { return }
            let loc = NSEvent.mouseLocation
            Task { @MainActor in
                guard let self else { return }
                if self.detector.add(loc) { self.trigger() }
            }
        }) { monitors.append(m) }

        if let m = NSEvent.addGlobalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown], handler: { [weak self] _ in
            Task { @MainActor in self?.dismiss() }
        }) { monitors.append(m) }

        if let m = NSEvent.addGlobalMonitorForEvents(matching: .keyDown, handler: { [weak self] e in
            if e.keyCode == 53 { Task { @MainActor in self?.dismiss() } }
        }) { monitors.append(m) }
        if let m = NSEvent.addLocalMonitorForEvents(matching: .keyDown, handler: { [weak self] e in
            if e.keyCode == 53 { Task { @MainActor in self?.dismiss() }; return nil }
            return e
        }) { monitors.append(m) }

        print("✅ Polaris running (model: \(Config.model)). Select text, then draw a quick circle with your cursor.")
    }

    private func dismiss() {
        guard popup.isVisible else { return }
        currentTask?.cancel()
        currentTask = nil
        popup.hide()
    }

    private func trigger() {
        let location = NSEvent.mouseLocation
        currentTask?.cancel()
        popup.hide()

        currentTask = Task { [weak self] in
            guard let self else { return }
            guard var selection = await SelectionReader.read(),
                  !selection.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                self.popup.setText("No selection found. Highlight some text first, then circle.")
                self.popup.show(near: location)
                return
            }
            if selection.count > Config.maxSelectionChars {
                selection = String(selection.prefix(Config.maxSelectionChars))
            }

            self.popup.setText("Thinking…")
            self.popup.show(near: location)

            var started = false
            do {
                try await Claude.stream(selection) { chunk in
                    if !started { started = true; self.popup.setText("") }
                    self.popup.append(chunk)
                }
                if !started { self.popup.setText("(Empty response)") }
            } catch is CancellationError {
            } catch let error as URLError where error.code == .cancelled {
            } catch {
                if !Task.isCancelled { self.popup.setText("⚠️ \(error.localizedDescription)") }
            }
        }
    }
}
