// Saves an Ask session to Saved Responses as it goes: the first answer creates the entry and every
// later answer updates it, so the whole conversation is kept however the popup gets closed.
import Foundation

@MainActor
final class ConversationSaver {
    private var savedId: String?
    /// Bumped for each new session, so a slow request from an earlier one can't touch this one.
    private var session = 0
    /// Saves run one after another: the update for turn 2 must not overtake the create for turn 1.
    private var queue: Task<Void, Never>?

    func startSession() {
        session += 1
        savedId = nil
        queue = nil
    }

    func save(turns: [(question: String, answer: String)], selection: String, app: String?, window: String?) {
        guard AccountLink.isConnected, !turns.isEmpty else { return }
        let mine = session
        let previous = queue
        queue = Task { [weak self] in
            await previous?.value
            guard let self, mine == self.session else { return }
            do {
                let id = try await PolarisAPI.saveConversation(id: self.savedId, selection: selection, turns: turns,
                                                               app: app, window: window)
                if mine == self.session { self.savedId = id }
            } catch {
                print("Couldn't save the conversation: \(error.localizedDescription)")
            }
        }
    }
}
