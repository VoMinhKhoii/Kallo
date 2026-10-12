import Intents
import UserNotifications

/// Turns a push from a person into an iOS communication notification: their
/// avatar where the app icon was, with the Kallo icon badged in the corner —
/// the shape Messages, Instagram and every chat app use.
///
/// The server marks such a push `mutable-content` and nests the person under
/// `sender` (`lib/infra/push/apns.ts`); anything else is handed back untouched.
/// The mechanism is Apple's: donate an incoming `INSendMessageIntent` whose
/// sender carries the image, then re-derive the content from that intent. The
/// app must declare `INSendMessageIntent` in `NSUserActivityTypes` and hold the
/// Communication Notifications entitlement, or iOS silently shows the plain
/// banner — which is also the failure mode of every path below: nothing here
/// can lose a notification, only its avatar.
final class NotificationService: UNNotificationServiceExtension {
  private let lock = NSLock()
  private var contentHandler: ((UNNotificationContent) -> Void)?
  private var original: UNNotificationContent?
  private var avatarTask: URLSessionTask?

  /// `NSLock.withLock` is iOS 16+; the deployment target is 15.5.
  private func locked<T>(_ body: () -> T) -> T {
    lock.lock()
    defer { lock.unlock() }
    return body()
  }

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    locked {
      self.contentHandler = contentHandler
      self.original = request.content
    }
    guard let sender = PushSender(userInfo: request.content.userInfo) else {
      deliver(request.content)
      return
    }
    let task = SenderAvatar.load(for: sender) { [weak self] image in
      self?.deliver(Self.communicationContent(request.content, sender: sender, avatar: image))
    }
    locked { avatarTask = task }
  }

  /// iOS gives an extension ~30 s. The avatar fetch times out well inside
  /// that, so this only fires on a stalled network — show the plain banner.
  override func serviceExtensionTimeWillExpire() {
    let pending = locked { () -> (URLSessionTask?, UNNotificationContent?) in
      (avatarTask, original)
    }
    pending.0?.cancel()
    if let content = pending.1 { deliver(content) }
  }

  /// Exactly once: the fetch callback and the expiry can race, and calling the
  /// handler twice is a crash.
  private func deliver(_ content: UNNotificationContent) {
    let handler = locked { () -> ((UNNotificationContent) -> Void)? in
      defer { contentHandler = nil }
      return contentHandler
    }
    handler?(content)
  }

  /// Rebuild the content from a donated incoming-message intent. iOS takes the
  /// title from the sender's display name, so the server's title (the same
  /// name) and body read identically with or without this step.
  private static func communicationContent(
    _ content: UNNotificationContent,
    sender: PushSender,
    avatar: INImage
  ) -> UNNotificationContent {
    let person = INPerson(
      personHandle: INPersonHandle(value: sender.id, type: .unknown),
      nameComponents: nil,
      displayName: sender.name,
      image: avatar,
      contactIdentifier: nil,
      customIdentifier: sender.id
    )
    let intent = INSendMessageIntent(
      recipients: nil,
      outgoingMessageType: .outgoingMessageText,
      content: content.body,
      speakableGroupName: nil,
      conversationIdentifier: sender.conversationId,
      serviceName: nil,
      sender: person,
      attachments: nil
    )
    intent.setImage(avatar, forParameterNamed: \.sender)

    let interaction = INInteraction(intent: intent, response: nil)
    interaction.direction = .incoming
    interaction.donate(completion: nil)

    do {
      return try content.updating(from: intent)
    } catch {
      return content
    }
  }
}
