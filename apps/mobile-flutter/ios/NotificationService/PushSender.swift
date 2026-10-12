import Foundation

/// The `sender` dict the server nests in a push from a person
/// (`lib/infra/push/apns.ts` → `buildApnsPayload`). Only `id` and `name` are
/// required; a payload without them is not a communication notification.
struct PushSender {
  let id: String
  let name: String
  /// https only — the server drops anything else before it is sent.
  let avatarURL: URL?
  /// Avatar seed, else handle: the key the in-app initials disc hashes.
  let tintKey: String?
  /// `chat:<groupId>` or `person:<userId>`; falls back to the person.
  let conversationId: String

  init?(userInfo: [AnyHashable: Any]) {
    guard
      let dict = userInfo["sender"] as? [String: Any],
      let id = dict["id"] as? String, !id.isEmpty,
      let name = dict["name"] as? String, !name.isEmpty
    else { return nil }
    self.id = id
    self.name = name
    self.avatarURL = (dict["avatarUrl"] as? String)
      .flatMap(URL.init(string:))
      .flatMap { $0.scheme == "https" ? $0 : nil }
    self.tintKey = dict["tintKey"] as? String
    self.conversationId = (dict["conversationId"] as? String) ?? "person:\(id)"
  }
}
