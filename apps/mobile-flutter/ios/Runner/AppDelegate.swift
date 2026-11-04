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
///   Dart → native   `registerForPush`  → Bool (asks for authorization, then
///                                         registers on grant)
///                   `registerIfAuthorized` → Bool (never asks: registers only
///                                         when already authorized)
///                   `getTimeZone`      → String (IANA, e.g. Asia/Ho_Chi_Minh)
///                   `setReminderCategories` ({titles: localized button
///                                         titles, apiBase: where the close
///                                         button posts})
///                   `takeClosedDays`   → [String] (days the lock-screen button
///                                         closed since the last call; drained)
///                   `getInitialTap`    → [String: Any]? (cold-start tap)
///   native → Dart   `onToken`      (String, lowercase hex device token)
///                   `onTokenError` (String, failure description)
///                   `onTap`        (Map, the notification's userInfo)
private let kPushChannelName = "com.khoivo.nham/push"

/// Meal-reminder action ids (docs/NOTIFICATIONS.md → "Reminders"). OPEN
/// launches the app (tap routing takes it from there, like a plain tap);
/// CLOSE runs in the background and never shows the app.
private let kReminderOpenAction = "REMINDER_OPEN"
private let kReminderCloseAction = "REMINDER_CLOSE_DAY"
/// Where the close button posts, saved by `setReminderCategories`: a button
/// pressed after the app was killed is answered before Dart ever runs.
private let kReminderApiBaseKey = "kallo.reminders.apiBase"
/// Days a close button closed while Dart was not looking; drained by
/// `takeClosedDays` so the app refreshes what it shows for them.
private let kReminderClosedDaysKey = "kallo.reminders.closedDays"

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
      case "registerIfAuthorized":
        self?.registerIfAuthorized(result: result)
      case "getTimeZone":
        result(TimeZone.current.identifier)
      case "setReminderCategories":
        Self.setReminderCategories(call.arguments as? [String: Any] ?? [:])
        result(nil)
      case "takeClosedDays":
        let days = UserDefaults.standard.stringArray(forKey: kReminderClosedDaysKey) ?? []
        UserDefaults.standard.removeObject(forKey: kReminderClosedDaysKey)
        result(days)
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

  /// The app-start path: registers a device that already said yes, and never
  /// shows the permission prompt — that waits for the first logged meal.
  private func registerIfAuthorized(result: @escaping FlutterResult) {
    UNUserNotificationCenter.current().getNotificationSettings { settings in
      DispatchQueue.main.async {
        let allowed: Bool
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
          allowed = true
        default:
          allowed = false
        }
        if allowed {
          UIApplication.shared.registerForRemoteNotifications()
        }
        result(allowed)
      }
    }
  }

  /// The three reminder categories, titled in the app's language (iOS draws
  /// action buttons from the device, never from the push).
  private static func setReminderCategories(_ args: [String: Any]) {
    if let base = args["apiBase"] as? String, !base.isEmpty {
      UserDefaults.standard.set(base, forKey: kReminderApiBaseKey)
    }
    let titles = args["titles"] as? [String: Any] ?? [:]
    func title(_ key: String) -> String { titles[key] as? String ?? key }
    func open(_ key: String) -> UNNotificationAction {
      UNNotificationAction(
        identifier: kReminderOpenAction, title: title(key), options: [.foreground])
    }
    func close(_ key: String) -> UNNotificationAction {
      UNNotificationAction(identifier: kReminderCloseAction, title: title(key), options: [])
    }
    let categories: Set<UNNotificationCategory> = [
      UNNotificationCategory(
        identifier: "REMINDER_YESTERDAY",
        actions: [open("addToYesterday"), close("thatWasAll")],
        intentIdentifiers: []),
      UNNotificationCategory(
        identifier: "REMINDER_LOG", actions: [open("logMeal")], intentIdentifiers: []),
      UNNotificationCategory(
        identifier: "REMINDER_EVENING",
        actions: [open("logMore"), close("doneForToday")],
        intentIdentifiers: []),
    ]
    UNUserNotificationCenter.current().setNotificationCategories(categories)
  }

  /// "That was all" / "I'm done for today": post the signed token the push
  /// carried. No session — refreshing the user's Supabase session from native
  /// code would rotate its refresh token out from under the app. Kept alive
  /// with a background task, and the system's completion handler is called
  /// only once the request settles (it allows about 30 s).
  private static func closeDayInBackground(
    userInfo: [AnyHashable: Any], completion: @escaping () -> Void
  ) {
    guard
      let token = userInfo["actionToken"] as? String,
      let base = UserDefaults.standard.string(forKey: kReminderApiBaseKey),
      let url = URL(string: base + "/api/v1/reminders/close-day")
    else {
      completion()
      return
    }
    var request = URLRequest(url: url, timeoutInterval: 20)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try? JSONSerialization.data(withJSONObject: ["token": token])
    var task: UIBackgroundTaskIdentifier = .invalid
    var done = false
    // Runs on the main queue only, and once: the response and the background
    // task's expiry can both arrive, and the system handler must be called once.
    let finish = {
      DispatchQueue.main.async {
        guard !done else { return }
        done = true
        if task != .invalid {
          UIApplication.shared.endBackgroundTask(task)
          task = .invalid
        }
        completion()
      }
    }
    task = UIApplication.shared.beginBackgroundTask(withName: "reminder-close-day") {
      finish()
    }
    let day = userInfo["date"] as? String
    URLSession.shared.dataTask(with: request) { _, response, _ in
      // Remember a closed day, so a still-running app refreshes it on resume.
      if let day = day, let http = response as? HTTPURLResponse,
        (200..<300).contains(http.statusCode)
      {
        DispatchQueue.main.async {
          var days = UserDefaults.standard.stringArray(forKey: kReminderClosedDaysKey) ?? []
          if !days.contains(day) { days.append(day) }
          UserDefaults.standard.set(days, forKey: kReminderClosedDaysKey)
        }
      }
      finish()
    }.resume()
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
    let userInfo = response.notification.request.content.userInfo
    if response.actionIdentifier == kReminderCloseAction {
      // Background only: the day is closed without showing the app.
      Self.closeDayInBackground(userInfo: userInfo, completion: completionHandler)
      return
    }
    let payload = Self.sanitize(userInfo)
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
