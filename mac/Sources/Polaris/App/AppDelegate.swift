// Starts the app: permissions, menu bar icon, polaris:// links, event monitors, and the circle → popup flow.
import AppKit
import ApplicationServices

@MainActor final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private let detector = CircleDetector()
    private lazy var popup = Popup()
    private var currentTask: Task<Void, Never>?
    private var selection: String?
    private var context: SelectionContext?
    private var monitors: [Any] = []
    private var statusItem: NSStatusItem?

    func applicationDidFinishLaunching(_ notification: Notification) {
        popup.onAction = { [weak self] action in self?.run(action) }
        popup.onBack = { [weak self] in self?.goBack() }
        popup.ask.onAsk = { [weak self] question in self?.ask(question) }
        FontLoader.registerBundledFonts()
        setUpMenuBar()
        Task { await SettingsStore.shared.refresh() }

        let opts = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        if !AXIsProcessTrustedWithOptions(opts) {
            print("""
            ⚠️  Accessibility permission needed.
               System Settings → Privacy & Security → Accessibility → enable Polaris (if you opened
               Polaris.app) or your terminal app (if you used swift run), then restart Polaris.
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
        // Keys while the popup is focused: Esc closes, Space plays/pauses, ← → move by one word,
        // Delete goes back. While typing a question, only Esc is ours.
        if let m = NSEvent.addLocalMonitorForEvents(matching: .keyDown, handler: { [weak self] e in
            guard let self else { return e }
            if self.popup.isTyping && e.keyCode != 53 { return e }
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

        print("✅ Polaris running (web app: \(Config.apiBaseURL.absoluteString)). Select text, then draw a quick circle with your cursor.")
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
        // Pick up settings saved on the web (quiz, settings page) since we last checked.
        Task { await SettingsStore.shared.refresh(ifOlderThan: 10) }

        currentTask = Task { [weak self] in
            guard let self else { return }
            guard AXIsProcessTrusted() else {
                self.popup.showText("Polaris needs Accessibility permission to read your selection. "
                    + "Turn on Polaris in System Settings → Privacy & Security → Accessibility, then quit and reopen Polaris.",
                    near: location)
                return
            }
            guard var selection = await SelectionReader.read(),
                  !selection.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                self.popup.showText("No selection found. Highlight some text first, then circle.", near: location)
                return
            }
            if selection.count > Config.maxSelectionChars {
                selection = String(selection.prefix(Config.maxSelectionChars))
            }
            self.selection = selection
            // Read the surrounding text now, while the other app still has focus.
            self.context = ContextReader.read(selection: selection)
            self.popup.showMenu(near: location)
        }
    }

    private func run(_ action: PopupAction) {
        guard let selection else { return }
        currentTask?.cancel()
        switch action {
        case .read:
            popup.showReader(selection)
        case .ask:
            popup.showAsk(context: context)
        case .simplify:
            simplify(selection)
        }
    }

    private func ask(_ question: String) {
        guard let context else { return }
        currentTask?.cancel()
        let history = popup.ask.history
        popup.ask.showLoading(question)
        currentTask = Task { [weak self] in
            guard let self else { return }
            do {
                let result = try await PolarisAPI.ask(question, context: context, history: history)
                if !Task.isCancelled { self.popup.ask.show(result, for: question) }
            } catch is CancellationError {
            } catch let error as URLError where error.code == .cancelled {
            } catch let error as URLError where error.code == .cannotConnectToHost {
                if !Task.isCancelled { self.popup.ask.showError(Self.cantReachWebApp, question: question) }
            } catch {
                if !Task.isCancelled { self.popup.ask.showError(error.localizedDescription, question: question) }
            }
        }
    }

    private func goBack() {
        currentTask?.cancel()
        currentTask = nil
        popup.backToMenu()
    }

    /// Rewrites the selection at the user's reading level (the web app also saves it to their account).
    private func simplify(_ text: String) {
        popup.showText("Simplifying…", canGoBack: true)
        let title = context?.pageTitle
        let app = NSWorkspace.shared.frontmostApplication?.localizedName
        currentTask = Task { [weak self] in
            guard let self else { return }
            do {
                let result = try await PolarisAPI.simplify(text, app: app, title: title)
                if !Task.isCancelled { self.popup.setText(result.isEmpty ? "(Empty response)" : result) }
            } catch is CancellationError {
            } catch let error as URLError where error.code == .cancelled {
            } catch let error as URLError where error.code == .cannotConnectToHost {
                if !Task.isCancelled { self.popup.setText("⚠️ \(Self.cantReachWebApp)") }
            } catch {
                if !Task.isCancelled { self.popup.setText("⚠️ \(error.localizedDescription)") }
            }
        }
    }

    private static var cantReachWebApp: String {
        "Can't reach the Polaris web app at \(Config.apiBaseURL.absoluteString). Is it running?"
    }

    // MARK: - polaris:// links

    func application(_ application: NSApplication, open urls: [URL]) {
        for url in urls where AccountLink.handle(url) { didConnect() }
    }

    private func didConnect() {
        popup.showText("✅ Polaris is connected to your account.", near: NSEvent.mouseLocation)
        Task { await SettingsStore.shared.refresh() }
    }

    // MARK: - Menu bar

    private func setUpMenuBar() {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        item.button?.image = NSImage(systemSymbolName: "star.fill", accessibilityDescription: "Polaris")
        let menu = NSMenu()
        menu.delegate = self
        item.menu = menu
        statusItem = item
    }

    /// Rebuilt each time it opens, so it always shows whether we're connected.
    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.removeAllItems()
        let connected = AccountLink.isConnected
        let status = NSMenuItem(title: connected ? "Connected to your account" : "Not connected", action: nil, keyEquivalent: "")
        status.isEnabled = false
        menu.addItem(status)
        if connected {
            menu.addItem(item("Refresh Reading Settings", #selector(refreshSettings)))
            menu.addItem(item("Disconnect", #selector(disconnect)))
        } else {
            menu.addItem(item("Connect Account…", #selector(connect)))
            menu.addItem(item("Paste Connect Token…", #selector(pasteToken)))
        }
        menu.addItem(.separator())
        menu.addItem(item("Quit Polaris", #selector(quit), key: "q"))
    }

    private func item(_ title: String, _ action: Selector, key: String = "") -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
        item.target = self
        return item
    }

    @objc private func connect() { AccountLink.openConnectPage() }

    /// For `swift run`, where polaris:// links can't reach the app: paste the token from /connect.
    @objc private func pasteToken() {
        NSApp.activate(ignoringOtherApps: true)
        let alert = NSAlert()
        alert.messageText = "Paste your connect token"
        alert.informativeText = "Open \(Config.apiBaseURL.absoluteString)/connect, copy the token (or the polaris:// link), and paste it here."
        let field = NSTextField(frame: NSRect(x: 0, y: 0, width: 300, height: 24))
        alert.accessoryView = field
        alert.addButton(withTitle: "Connect")
        alert.addButton(withTitle: "Cancel")
        alert.window.initialFirstResponder = field
        guard alert.runModal() == .alertFirstButtonReturn else { return }

        let value = field.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        if let url = URL(string: value), url.scheme == "polaris" {
            if AccountLink.handle(url) { didConnect() }
        } else if !value.isEmpty {
            AccountLink.save(value)
            didConnect()
        }
    }

    @objc private func refreshSettings() { Task { await SettingsStore.shared.refresh() } }

    @objc private func disconnect() {
        AccountLink.disconnect()
        SettingsStore.shared.update(.default)
    }

    @objc private func quit() { NSApp.terminate(nil) }
}
