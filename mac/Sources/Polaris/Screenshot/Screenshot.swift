// Screenshot: drag over part of the screen (macOS's own ⌘⇧4 crosshair), then read the text in it
// on this Mac with Vision. The text and a shrunk JPEG stand in for selected text in every feature.
import AppKit
import Vision

struct Screenshot {
    let image: CGImage
    /// Text recognized in the image, in reading order ("" if there's none).
    let text: String
    /// Base64 JPEG (longest side at most 1600px) sent to the web app for Ask, Simplify and Write.
    let jpeg: String?

    enum Problem: LocalizedError {
        case needsPermission

        var errorDescription: String? {
            "Polaris needs Screen Recording permission for screenshots. Turn on Polaris in System Settings → "
                + "Privacy & Security → Screen & System Audio Recording, then quit and reopen Polaris."
        }
    }

    /// Lets the user drag out a region; nil if they press Esc.
    static func take() async throws -> Screenshot? {
        guard CGPreflightScreenCaptureAccess() else {
            CGRequestScreenCaptureAccess()
            throw Problem.needsPermission
        }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("polaris-\(UUID().uuidString).png")
        defer { try? FileManager.default.removeItem(at: url) }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
        process.arguments = ["-i", "-x", url.path]   // interactive, no sound
        await withCheckedContinuation { (done: CheckedContinuation<Void, Never>) in
            process.terminationHandler = { _ in done.resume() }
            do { try process.run() } catch { done.resume() }
        }

        guard let data = try? Data(contentsOf: url),
              let image = NSBitmapImageRep(data: data)?.cgImage else { return nil }
        return Screenshot(image: image, text: await recognizeText(in: image), jpeg: jpegBase64(image))
    }

    /// The text in `image`, lines joined into paragraphs (blank line where there's a bigger gap).
    static func recognizeText(in image: CGImage) async -> String {
        await Task.detached(priority: .userInitiated) {
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true
            try? VNImageRequestHandler(cgImage: image).perform([request])
            let lines: [Line] = (request.results ?? []).compactMap { obs in
                guard let best = obs.topCandidates(1).first else { return nil }
                return Line(box: obs.boundingBox, text: best.string)
            }
            var text = ""
            var previous: CGRect?
            for line in lines.sorted(by: Line.readingOrder) {
                if let p = previous {
                    let gap = p.minY - line.box.maxY
                    text += gap > p.height * 0.8 ? "\n\n" : " "
                }
                text += line.text
                previous = line.box
            }
            return text
        }.value
    }

    private struct Line {
        let box: CGRect
        let text: String

        /// Top to bottom, then left to right on the same line. Vision's boxes start at the
        /// bottom left, so higher lines have a bigger y.
        static func readingOrder(_ a: Line, _ b: Line) -> Bool {
            let sameLine = abs(a.box.midY - b.box.midY) < min(a.box.height, b.box.height) / 2
            return sameLine ? a.box.minX < b.box.minX : a.box.midY > b.box.midY
        }
    }

    private static func jpegBase64(_ image: CGImage, maxSide: CGFloat = 1600) -> String? {
        let scale = min(1, maxSide / CGFloat(max(image.width, image.height)))
        let w = Int(CGFloat(image.width) * scale), h = Int(CGFloat(image.height) * scale)
        guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
                                  space: CGColorSpaceCreateDeviceRGB(),
                                  bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { return nil }
        ctx.interpolationQuality = .high
        ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
        guard let scaled = ctx.makeImage() else { return nil }
        return NSBitmapImageRep(cgImage: scaled)
            .representation(using: .jpeg, properties: [.compressionFactor: 0.75])?.base64EncodedString()
    }
}
