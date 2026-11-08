// Detects the circle cursor gesture that triggers Polaris: three loops in a row, so ordinary
// mouse movement doesn't set it off by accident.
import Foundation

final class CircleDetector {
    private struct P { let x: CGFloat; let y: CGFloat; let t: TimeInterval }
    private var pts: [P] = []
    private var lastFire: TimeInterval = 0

    /// Full loops needed, and how long the user has to draw them.
    let turns: CGFloat = 3
    let window: TimeInterval = 2.0
    let cooldown: TimeInterval = 1.5
    let minSize: CGFloat = 40
    let maxSize: CGFloat = 600

    func add(_ p: CGPoint) -> Bool {
        let now = ProcessInfo.processInfo.systemUptime
        if let last = pts.last, hypot(p.x - last.x, p.y - last.y) < 3 { return false }
        pts.append(P(x: p.x, y: p.y, t: now))
        pts.removeAll { now - $0.t > window }
        guard pts.count >= 8, now - lastFire > cooldown else { return false }

        var total: CGFloat = 0
        var prevHeading: CGFloat?
        var runStart = 0

        for i in 1..<pts.count {
            let heading = atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x)
            if let ph = prevHeading {
                var d = heading - ph
                while d > .pi { d -= 2 * .pi }
                while d < -.pi { d += 2 * .pi }
                if abs(d) > 1.5 {
                    total = 0
                    runStart = i - 1
                } else {
                    total += d
                }
            }
            prevHeading = heading

            if abs(total) >= turns * 2 * .pi {
                let run = pts[runStart...i]
                let xs = run.map(\.x), ys = run.map(\.y)
                let w = xs.max()! - xs.min()!, h = ys.max()! - ys.min()!
                let size = max(w, h)
                let roundness = min(w, h) / max(max(w, h), 1)
                if size >= minSize && size <= maxSize && roundness > 0.5 {
                    lastFire = now
                    pts.removeAll()
                    return true
                }
            }
        }
        return false
    }
}
