import Flutter
import UIKit
import UserNotifications

/// APNs registration bridge — the native half of `lib/services/push/`.
///
/// No third-party push SDK: `UNUserNotificationCenter` asks for permission,
/// UIKit hands back the APNs device token, and the raw hex string crosses one
/// `FlutterMethodChannel` to Dart, which registers it with
/// `POST /api/v1/notifications/push-tokens`.
///
/// Channel contract (mirrored by `PushChannel` in Dart):
///   Dart → native   `registerForPush`  → Bool (authorization granted)
///                   `getInitialTap`    → [String: Any]? (cold-start tap)
///   native → Dart   `onToken`      (String, lowercase hex device token)
///                   `onTokenError` (String, failure description)
///                   `onTap`        (Map, the notification's userInfo)
private let kPushChannelName = "com.khoivo.nham/push"

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  private var pushChannel: FlutterMethodChannel?

  /// A tap that COLD-STARTED the app fires before Dart has a handler attached,
  /// so it is held here and drained by `getInitialTap` — the same idiom as
  /// `AppLinks.getInitialLink()` used for invite deep links.
  private var initialTapPayload: [String: Any]?
  private var initialTapConsumed = false

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    // FlutterAppDelegate forwards these callbacks to plugins but never claims
    // the delegate itself; no notification plugin is installed, so we do.
    UNUserNotificationCenter.current().delegate = self
    if let launchPayload = launchOptions?[.remoteNotification] as? [AnyHashable: Any] {
      initialTapPayload = Self.sanitize(launchPayload)
    }
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)

    let channel = FlutterMethodChannel(
      name: kPushChannelName,
      binaryMessenger: engineBridge.applicationRegistrar.messenger()
    )
    channel.setMethodCallHandler { [weak self] call, result in
      switch call.method {
      case "registerForPush":
        self?.requestAuthorization(result: result)
      case "getInitialTap":
        // Drained once: a later re-registration must not re-route an old tap.
        let payload = self?.initialTapConsumed == true ? nil : self?.initialTapPayload
        self?.initialTapConsumed = true
        self?.initialTapPayload = nil
        result(payload)
      default:
        result(FlutterMethodNotImplemented)
      }
    }
    pushChannel = channel
  }

  /// Ask for alert/badge/sound, then register with APNs on grant. The token
  /// itself arrives asynchronously in `didRegisterForRemoteNotifications…`.
  private func requestAuthorization(result: @escaping FlutterResult) {
    UNUserNotificationCenter.current()
      .requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
        DispatchQueue.main.async {
          if let error = error {
            self.pushChannel?.invokeMethod("onTokenError", arguments: error.localizedDescription)
          }
          if granted {
            UIApplication.shared.registerForRemoteNotifications()
          }
          result(granted)
        }
      }
  }

  override func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    let hex = deviceToken.map { String(format: "%02x", $0) }.joined()
    pushChannel?.invokeMethod("onToken", arguments: hex)
    super.application(
      application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
  }

  override func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    // Surfaced rather than swallowed: on a device with no APNs entitlement (or
    // no network at launch) this is the only signal Dart ever gets.
    pushChannel?.invokeMethod("onTokenError", arguments: error.localizedDescription)
    super.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
  }

  /// Show alerts while the app is foregrounded too (iOS suppresses them by
  /// default). Deployment target is 15.5, so `.banner` is always available.
  ///
  /// The completion handler is called here instead of via `super`, which would
  /// hand it to the plugin life-cycle delegate; nothing else answers it, and a
  /// double call would trap.
  override func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    completionHandler([.banner, .sound, .badge])
  }

  override func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    let payload = Self.sanitize(response.notification.request.content.userInfo)
    if let channel = pushChannel {
      channel.invokeMethod("onTap", arguments: payload)
    } else {
      // Tapped before the engine was up — replay through `getInitialTap`.
      initialTapPayload = payload
      initialTapConsumed = false
    }
    completionHandler()
  }

  /// Reduce an APNs `userInfo` to values the standard method codec can carry:
  /// string keys, and string/number/bool leaves (nested dictionaries kept, so a
  /// payload nesting its fields under `data` survives as well as a flat one).
  private static func sanitize(_ input: [AnyHashable: Any]) -> [String: Any] {
    var output: [String: Any] = [:]
    for (key, value) in input {
      guard let name = key as? String else { continue }
      switch value {
      case let nested as [AnyHashable: Any]:
        output[name] = sanitize(nested)
      case let text as String:
        output[name] = text
      case let number as NSNumber:
        output[name] = number
      default:
        continue
      }
    }
    return output
  }
}
