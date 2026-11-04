import Flutter
import WidgetKit

/// The app's half of the home-screen widget: Dart hands over the day as one
/// JSON string, this stores it in the App Group the extension reads, and asks
/// WidgetKit to redraw. One call, so no plugin.
///
/// Channel contract (mirrored by `TodayWidgetChannel` in Dart):
///   Dart → native   `save`  (String JSON) → nil
/// Sign-out is a `save` too, of the signed-out card, which holds no day.
enum TodayWidgetChannel {
  static let name = "com.khoivo.nham/today_widget"
  /// Shared with `TodayWidget/TodaySnapshot.swift` and both entitlements files.
  static let appGroup = "group.com.khoivo.nham"
  static let key = "today.snapshot"
  /// The widget's `kind` (`TodayWidget.kind`).
  static let kind = "TodayWidget"

  static func register(with messenger: FlutterBinaryMessenger) {
    let channel = FlutterMethodChannel(name: name, binaryMessenger: messenger)
    channel.setMethodCallHandler { call, result in
      guard let defaults = UserDefaults(suiteName: appGroup) else {
        result(FlutterError(code: "NO_APP_GROUP", message: appGroup, details: nil))
        return
      }
      guard call.method == "save" else {
        result(FlutterMethodNotImplemented)
        return
      }
      guard let json = call.arguments as? String else {
        result(FlutterError(code: "BAD_ARGS", message: "save takes a String", details: nil))
        return
      }
      defaults.set(json, forKey: key)
      WidgetCenter.shared.reloadTimelines(ofKind: kind)
      result(nil)
    }
  }
}
