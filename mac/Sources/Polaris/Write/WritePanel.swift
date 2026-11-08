// Write view in the popup: talk, watch your words appear, then get them back as tidy notes
// you can edit, hear, copy, and save into a catalog.
// When text was selected, it's sent along so the note can be about it.
import AppKit

@MainActor
final class WritePanel: NSView {
    private enum Phase { case recording, working, result }

    private let header = NSTextField(labelWithString: "")
    private let scroll = NSScrollView()
    private let textView = NSTextView()
    private let titleField = NSTextField()
    private let micButton = FirstClickButton()
    private let status = NSTextField(labelWithString: "")
    private let level = NSLevelIndicator()
    private let actionRow = NSView()
    private let catalogBox = NSComboBox()
    private let newCatalogButton = FirstClickButton()
    /// True after "New catalog" until the name is entered (Return) or a catalog is picked.
    private var namingCatalog = false
    private let speakButton = FirstClickButton()
    private var doneChip: NSButton?
    private var saveChip: NSButton?

    private let transcriber = Transcriber()
    private let reader = SpeechReader()
    private let highlighter: WordHighlighter
    private var phase = Phase.recording
    private var context: SelectionContext?
    private var sourceApp: String?
    private var task: Task<Void, Never>?
    private var clock: Timer?
    private var listenedBefore: TimeInterval = 0
    private var listeningSince: Date?
    private var problem: String?

    private var settings: ReaderSettings { SettingsStore.shared.settings }

    override init(frame: NSRect) {
        highlighter = WordHighlighter(textView: textView)
        super.init(frame: frame)

        scroll.hasVerticalScroller = true
        scroll.drawsBackground = false
        textView.drawsBackground = false
        textView.textContainerInset = NSSize(width: 4, height: 4)
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.autoresizingMask = [.width]
        textView.textContainer?.widthTracksTextView = true
        textView.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: .greatestFiniteMagnitude)
        textView.isRichText = false
        textView.allowsUndo = true
        scroll.documentView = textView

        titleField.isBordered = false
        titleField.drawsBackground = false
        titleField.focusRingType = .none
        titleField.placeholderString = "Title"

        header.lineBreakMode = .byTruncatingTail
        status.lineBreakMode = .byTruncatingTail
        level.levelIndicatorStyle = .continuousCapacity
        level.minValue = 0
        level.maxValue = 1

        micButton.isBordered = false
        micButton.wantsLayer = true
        micButton.target = self
        micButton.action = #selector(toggleMic)

        catalogBox.completes = true
        catalogBox.focusRingType = .none
        catalogBox.target = self
        catalogBox.action = #selector(catalogEntered)

        newCatalogButton.isBordered = false
        newCatalogButton.image = NSImage(systemSymbolName: "folder.badge.plus", accessibilityDescription: "New catalog")?
            .withSymbolConfiguration(.init(pointSize: 18, weight: .regular))
        newCatalogButton.toolTip = "New catalog"
        newCatalogButton.target = self
        newCatalogButton.action = #selector(newCatalog)

        speakButton.isBordered = false
        speakButton.target = self
        speakButton.action = #selector(speak)

        for v in [header, scroll, titleField, micButton, status, level, actionRow, catalogBox, newCatalogButton, speakButton] as [NSView] {
            addSubview(v)
        }

        transcriber.onText = { [weak self] _ in self?.showTranscript() }
        transcriber.onLevel = { [weak self] value in self?.level.doubleValue = Double(value) }
        reader.onWord = { [weak self] range in self?.highlighter.highlight(range) }
        reader.onStateChange = { [weak self] playing in self?.setSpeaking(playing) }
    }

    required init?(coder: NSCoder) { fatalError() }

    // MARK: - Starting and stopping

    /// A new note, about `context` if text was selected; starts listening right away.
    func reset(context: SelectionContext?, sourceApp: String?) {
        stop()
        transcriber.reset()
        self.context = context
        self.sourceApp = sourceApp
        listenedBefore = 0
        problem = nil
        titleField.stringValue = ""
        catalogBox.stringValue = ""
        namingCatalog = false
        applySettings()
        loadCatalogs()
        setPhase(.recording)
        startListening()
    }

    /// Stops listening, reading, and any request (the popup closed or went back).
    func stop() {
        task?.cancel()
        task = nil
        pauseListening()
        reader.stop()
    }

    /// Space: mic on/off while talking, read aloud once the note is written.
    func spaceKey() {
        switch phase {
        case .recording: toggleMic()
        case .result: speak()
        case .working: break
        }
    }

    func step(_ delta: Int) {
        if phase == .result { reader.step(delta, textView.string) }
    }

    // MARK: - Listening

    private func startListening() {
        problem = nil
        task = Task { [weak self] in
            guard let self else { return }
            do {
                try await self.transcriber.start()
                self.listeningSince = Date()
                self.startClock()
            } catch {
                self.problem = error.localizedDescription
                self.showTranscript()
            }
            self.updateRecordingUI()
        }
    }

    private func pauseListening() {
        if let since = listeningSince { listenedBefore += Date().timeIntervalSince(since) }
        listeningSince = nil
        transcriber.stop()
        clock?.invalidate()
        clock = nil
    }

    @objc private func toggleMic() {
        guard phase == .recording else { return }
        if transcriber.isRecording { pauseListening(); updateRecordingUI() } else { startListening() }
    }

    private func startClock() {
        clock?.invalidate()
        let timer = Timer(timeInterval: 0.5, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.updateRecordingUI() }
        }
        RunLoop.main.add(timer, forMode: .common)
        clock = timer
    }

    private func showTranscript() {
        guard phase == .recording else { return }
        let said = transcriber.transcript
        if let problem, said.isEmpty {
            textView.textStorage?.setAttributedString(settings.styled("⚠️ " + problem))
        } else if said.isEmpty {
            textView.textStorage?.setAttributedString(dim("Start talking. Your words will show up here, and I'll turn them into a tidy note."))
        } else {
            textView.textStorage?.setAttributedString(settings.styled(said))
            textView.scrollToEndOfDocument(nil)
        }
    }

    private func updateRecordingUI() {
        guard phase == .recording else { return }
        let on = transcriber.isRecording
        micButton.image = NSImage(systemSymbolName: on ? "mic.fill" : "mic", accessibilityDescription: on ? "Pause" : "Listen")?
            .withSymbolConfiguration(.init(pointSize: 18, weight: .semibold))
        micButton.contentTintColor = on ? .white : settings.textColor
        micButton.layer?.backgroundColor = (on ? NSColor.systemRed : settings.textColor.withAlphaComponent(0.1)).cgColor
        micButton.toolTip = on ? "Pause (Space)" : "Keep listening (Space)"
        let seconds = Int(listenedBefore + (listeningSince.map { Date().timeIntervalSince($0) } ?? 0))
        let time = String(format: "%d:%02d", seconds / 60, seconds % 60)
        if problem != nil {
            setStatus("Couldn't start listening.")
        } else {
            setStatus(on ? "Listening… \(time)" : "Paused \(time). Tap the mic to keep going.")
        }
        level.isHidden = !on
        if !on { level.doubleValue = 0 }
    }

    // MARK: - Writing the note

    @objc private func done() {
        pauseListening()
        let said = transcriber.transcript
        guard !said.isEmpty else {
            problem = nil
            updateRecordingUI()
            setStatus("I didn't hear anything yet. Tap the mic and talk.")
            return
        }
        writeNote()
    }

    private func writeNote() {
        reader.stop()
        setPhase(.working)
        let said = transcriber.transcript
        let context = self.context
        task?.cancel()
        task = Task { [weak self] in
            do {
                let result = try await PolarisAPI.write(said, context: context)
                guard let self, !Task.isCancelled else { return }
                self.showResult(result)
            } catch {
                guard let self, !Task.isCancelled else { return }
                if (error as? URLError)?.code == .cancelled { return }
                self.showResult(nil, error: error)
            }
        }
    }

    private func showResult(_ result: WriteResult?, error: Error? = nil) {
        setPhase(.result)
        if let result {
            titleField.stringValue = result.title
            textView.textStorage?.setAttributedString(settings.styled(result.note))
            textView.isEditable = true
            if catalogBox.stringValue.isEmpty { catalogBox.stringValue = result.catalog }
            setStatus("Edit anything, then save it to a catalog.")
            saveChip?.isEnabled = true
        } else {
            let message = (error as? URLError)?.code == .cannotConnectToHost
                ? "Can't reach the Polaris web app at \(Config.apiBaseURL.absoluteString). Is it running?"
                : error?.localizedDescription ?? "Something went wrong"
            textView.isEditable = false
            textView.textStorage?.setAttributedString(settings.styled("⚠️ " + message))
            setStatus("Tap Keep talking, then Done to try again.")
            saveChip?.isEnabled = false
        }
        textView.scrollToBeginningOfDocument(nil)
    }

    @objc private func keepTalking() {
        reader.stop()
        setPhase(.recording)
        startListening()
    }

    @objc private func copyNote() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(textView.string, forType: .string)
        setStatus("Copied. Paste it anywhere with ⌘V.")
    }

    @objc private func save() {
        let note = textView.string.trimmingCharacters(in: .whitespacesAndNewlines)
        guard phase == .result, !note.isEmpty else { return }
        let title = titleField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        let catalog = catalogBox.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        let said = transcriber.transcript
        saveChip?.isEnabled = false
        setStatus("Saving…")
        task = Task { [weak self] in
            guard let self else { return }
            do {
                try await PolarisAPI.saveNote(title: title.isEmpty ? "Note" : title, note: note, transcript: said,
                                              catalog: catalog.isEmpty ? nil : catalog,
                                              app: self.sourceApp, window: self.context?.pageTitle)
                guard !Task.isCancelled else { return }
                self.setStatus(catalog.isEmpty ? "✓ Saved to Saved Responses." : "✓ Saved in \(catalog).")
                self.loadCatalogs()
            } catch {
                guard !Task.isCancelled else { return }
                self.setStatus("⚠️ " + error.localizedDescription)
                self.saveChip?.isEnabled = true
            }
        }
    }

    @objc private func speak() {
        guard phase == .result, !textView.string.isEmpty else { return }
        reader.rate = Float(settings.readingSpeed)
        reader.voiceIdentifier = settings.voice
        reader.togglePlay(textView.string)
    }

    /// Clears the catalog box for a new name; Return creates it.
    @objc private func newCatalog() {
        guard phase == .result else { return }
        namingCatalog = true
        catalogBox.stringValue = ""
        setCatalogPlaceholder("New catalog name, then Return")
        window?.makeFirstResponder(catalogBox)
        setStatus("Name your new catalog and press Return.")
    }

    /// Return in the catalog box (or picking one from the list).
    @objc private func catalogEntered() {
        let name = catalogBox.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        let existing = catalogBox.objectValues.compactMap { $0 as? String }
        guard namingCatalog, !name.isEmpty,
              !existing.contains(where: { $0.caseInsensitiveCompare(name) == .orderedSame }) else {
            endNamingCatalog()
            return
        }
        setStatus("Creating “\(name)”…")
        Task { [weak self] in
            do {
                let saved = try await PolarisAPI.createCatalog(name)
                guard let self else { return }
                self.catalogBox.addItem(withObjectValue: saved)
                self.catalogBox.stringValue = saved
                self.endNamingCatalog()
                self.setStatus("✓ Made “\(saved)”. Save to put this note in it.")
            } catch {
                self?.setStatus("⚠️ " + error.localizedDescription)
            }
        }
    }

    private func endNamingCatalog() {
        namingCatalog = false
        setCatalogPlaceholder("Catalog (optional)")
    }

    private func setCatalogPlaceholder(_ s: String) {
        catalogBox.placeholderAttributedString = NSAttributedString(string: s, attributes: [
            .font: settings.font, .foregroundColor: NSColor.placeholderTextColor,
        ])
    }

    private func loadCatalogs() {
        Task { [weak self] in
            guard let names = try? await PolarisAPI.catalogs() else { return }
            self?.catalogBox.removeAllItems()
            self?.catalogBox.addItems(withObjectValues: names)
        }
    }

    // MARK: - Look

    private func setPhase(_ next: Phase) {
        phase = next
        let recording = next == .recording, result = next == .result
        micButton.isHidden = !recording
        level.isHidden = !recording
        doneChip?.isHidden = !recording
        titleField.isHidden = !result
        actionRow.isHidden = !result
        catalogBox.isHidden = !result
        newCatalogButton.isHidden = !result
        saveChip?.isHidden = !result
        speakButton.isHidden = !result
        status.isHidden = next == .working
        textView.isEditable = false
        setSpeaking(false)

        switch next {
        case .recording:
            showTranscript()
            updateRecordingUI()
        case .working:
            textView.textStorage?.setAttributedString(dim("Writing your note…"))
        case .result:
            break
        }
        needsLayout = true
    }

    private func applySettings() {
        let color = settings.textColor
        header.attributedStringValue = small(context.map { "About your selection: “\(Self.preview($0.selection))”" }
            ?? "Say what's on your mind and I'll write it up.")
        titleField.font = NSFontManager.shared.convert(settings.font, toHaveTrait: .boldFontMask)
        titleField.textColor = color
        textView.typingAttributes = settings.textAttributes
        textView.insertionPointColor = color
        catalogBox.font = settings.font
        setCatalogPlaceholder("Catalog (optional)")
        newCatalogButton.contentTintColor = color
        speakButton.contentTintColor = color
        micButton.layer?.cornerRadius = 22

        // Chips are rebuilt so they use the current reading font.
        doneChip?.removeFromSuperview()
        saveChip?.removeFromSuperview()
        let done = Chip.make("Done", symbol: "checkmark", filled: true, settings: settings, target: self, action: #selector(done))
        done.toolTip = "Turn what you said into a note"
        let save = Chip.make("Save", symbol: "tray.and.arrow.down", filled: true, settings: settings, target: self, action: #selector(save))
        save.toolTip = "Save to Saved Responses on the web app"
        addSubview(done)
        addSubview(save)
        doneChip = done
        saveChip = save

        actionRow.subviews.forEach { $0.removeFromSuperview() }
        actionRow.addSubview(Chip.make("Keep talking", symbol: "mic", settings: settings, target: self, action: #selector(keepTalking)))
        actionRow.addSubview(Chip.make("Copy", symbol: "doc.on.doc", settings: settings, target: self, action: #selector(copyNote)))
    }

    private func setStatus(_ s: String) { status.attributedStringValue = small(s) }

    private func setSpeaking(_ playing: Bool) {
        speakButton.image = NSImage(systemSymbolName: playing ? "pause.fill" : "speaker.wave.2.fill",
                                    accessibilityDescription: playing ? "Pause" : "Read aloud")
        speakButton.toolTip = playing ? "Pause" : "Read the note aloud"
        speakButton.contentTintColor = settings.textColor
    }

    /// Secondary text in the reading font, a bit smaller and dimmer.
    private func small(_ s: String) -> NSAttributedString {
        let font = NSFont(descriptor: settings.font.fontDescriptor, size: max(12, CGFloat(settings.fontSize) * 0.8)) ?? settings.font
        let oneLine = NSMutableParagraphStyle()
        oneLine.lineBreakMode = .byTruncatingTail
        return NSAttributedString(string: s, attributes: [
            .font: font,
            .paragraphStyle: oneLine,
            .foregroundColor: settings.textColor.withAlphaComponent(0.65),
            .kern: CGFloat(settings.letterSpacing) * font.pointSize,
        ])
    }

    private func dim(_ s: String) -> NSAttributedString {
        let styled = NSMutableAttributedString(attributedString: settings.styled(s))
        styled.addAttribute(.foregroundColor, value: settings.textColor.withAlphaComponent(0.45),
                            range: NSRange(location: 0, length: styled.length))
        return styled
    }

    private static func preview(_ s: String) -> String {
        let flat = s.split(whereSeparator: \.isNewline).joined(separator: " ").trimmingCharacters(in: .whitespaces)
        return flat.count > 60 ? String(flat.prefix(60)) + "…" : flat
    }

    // MARK: - Layout (frames by hand, like the rest of the popup)

    /// Top to bottom: Back (drawn by Popup) and 🔊, the header, then either
    /// [transcript | mic, status, Done] or [title, note, Keep talking/Copy, catalog + Save].
    override func layout() {
        super.layout()
        let w = bounds.width, pad: CGFloat = 12, topBar: CGFloat = 36, gap: CGFloat = 8
        let chipH = Chip.height(settings), fieldH = max(28, settings.lineHeight + 10)
        let smallH = ceil(small("Ag").size().height)
        var top = bounds.height - topBar
        speakButton.frame = NSRect(x: w - pad - 32, y: top + 4, width: 32, height: 28)

        header.frame = NSRect(x: pad, y: top - smallH, width: w - pad * 2, height: smallH)
        top -= smallH + gap
        var bottom = pad

        switch phase {
        case .recording, .working:
            let rowH = max(44, chipH)
            micButton.frame = NSRect(x: pad, y: bottom + (rowH - 44) / 2, width: 44, height: 44)
            let doneW = doneChip.map(Chip.width) ?? 0
            doneChip?.frame = NSRect(x: w - pad - doneW, y: bottom + (rowH - chipH) / 2, width: doneW, height: chipH)
            let textX = pad + 44 + 10, textW = max(0, w - textX - doneW - pad - 10)
            status.frame = NSRect(x: textX, y: bottom + rowH / 2, width: textW, height: smallH)
            level.frame = NSRect(x: textX, y: bottom + rowH / 2 - 10, width: min(140, textW), height: 6)
            if phase == .working { status.frame.origin.x = pad }
            bottom += rowH + gap

        case .result:
            let saveW = saveChip.map(Chip.width) ?? 0
            saveChip?.frame = NSRect(x: w - pad - saveW, y: bottom + (fieldH - chipH) / 2, width: saveW, height: chipH)
            newCatalogButton.frame = NSRect(x: w - pad - saveW - 8 - 32, y: bottom + (fieldH - 28) / 2, width: 32, height: 28)
            catalogBox.frame = NSRect(x: pad, y: bottom + (fieldH - 26) / 2, width: max(80, w - pad * 2 - saveW - 8 - 40),
                                      height: max(26, fieldH - 2))
            bottom += fieldH + gap
            status.frame = NSRect(x: pad, y: bottom, width: w - pad * 2, height: smallH)
            bottom += smallH + gap
            actionRow.frame = NSRect(x: pad, y: bottom, width: w - pad * 2, height: flow(actionRow, width: w - pad * 2))
            bottom += actionRow.frame.height + gap

            titleField.frame = NSRect(x: pad, y: top - fieldH, width: w - pad * 2, height: fieldH)
            top -= fieldH + 2
        }

        scroll.frame = NSRect(x: pad - 4, y: bottom, width: w - pad * 2 + 8, height: max(0, top - bottom))
    }

    /// Lays out `row`'s chips left to right, wrapping; returns the height used.
    private func flow(_ row: NSView, width: CGFloat) -> CGFloat {
        let h = Chip.height(settings)
        var x: CGFloat = 0, line = 0
        var frames: [NSRect] = []
        for chip in row.subviews {
            let cw = min(width, Chip.width(chip as! NSButton))
            if x > 0 && x + cw > width { x = 0; line += 1 }
            frames.append(NSRect(x: x, y: CGFloat(line) * (h + 6), width: cw, height: h))
            x += cw + 6
        }
        let total = row.subviews.isEmpty ? 0 : CGFloat(line + 1) * h + CGFloat(line) * 6
        for (chip, f) in zip(row.subviews, frames) {
            chip.frame = NSRect(x: f.minX, y: total - f.maxY, width: f.width, height: f.height)
        }
        return total
    }
}
