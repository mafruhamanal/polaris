// Starts the app: permissions, event monitors, and the circle → selection → popup flow.
import AppKit
import ApplicationServices

@MainActor final class AppDelegate: NSObject, NSApplicationDelegate {
    private let detector = CircleDetector()
    private lazy var popup = Popup()
    private var currentTask: Task<Void, Never>?
    private var selection: String?
    private var monitors: [Any] = []

    func applicationDidFinishLaunching(_ notification: Notification) {
        guard !Config.apiKey.isEmpty else {
            print("❌ Set GEMINI_API_KEY first:  export GEMINI_API_KEY=...")
            exit(1)
        }

        popup.onAction = { [weak self] action in self?.run(action) }
        popup.onBack = { [weak self] in self?.goBack() }
        FontLoader.registerBundledFonts()

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
        // Keys while the popup is focused: Esc closes, Space plays/pauses, ← → move by one word.
        if let m = NSEvent.addLocalMonitorForEvents(matching: .keyDown, handler: { [weak self] e in
            guard let self else { return e }
            switch e.keyCode {
            case 53: self.dismiss()
            case 51 where self.popup.canGoBack: self.goBack()
            case 49: self.popup.togglePlay()
            case 123: self.popup.step(-1)
            case 124: self.popup.step(1)
            default: return e
            }
            return nil
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
                self.popup.showText("No selection found. Highlight some text first, then circle.", near: location)
                return
            }
            if selection.count > Config.maxSelectionChars {
                selection = String(selection.prefix(Config.maxSelectionChars))
            }
            self.selection = selection
            self.popup.showMenu(near: location)
        }
    }

    private func run(_ action: PopupAction) {
        guard let selection else { return }
        currentTask?.cancel()
        switch action {
        case .read:
            popup.showReader(selection)
        case .explain:
            streamAI(selection, prompt: Config.explainPrompt)
        case .simplify:
            streamAI(selection, prompt: Config.simplifyPrompt(level: SettingsStore.shared.settings.readingLevel))
        }
    }

    private func goBack() {
        currentTask?.cancel()
        currentTask = nil
        popup.backToMenu()
    }

    private func streamAI(_ text: String, prompt: String) {
        popup.showText("Thinking…", canGoBack: true)
        currentTask = Task { [weak self] in
            guard let self else { return }
            var started = false
            do {
                try await AI.stream(text, system: prompt) { chunk in
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
