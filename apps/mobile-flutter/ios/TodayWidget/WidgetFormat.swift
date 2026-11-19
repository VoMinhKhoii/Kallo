import Foundation

/// The little formatting the widget must do itself, because it has to keep
/// working at midnight without the app: the date header and the dial figures
/// of a day the app has not written yet. Everything else arrives formatted.
struct WidgetFormat {
  let locale: Locale

  init(_ identifier: String) {
    locale = Locale(identifier: identifier)
  }

  /// Locale grouping, as the app's `formatCount` (en "1,932", vi "1.932").
  func count(_ n: Int) -> String {
    let formatter = NumberFormatter()
    formatter.locale = locale
    formatter.numberStyle = .decimal
    formatter.maximumFractionDigits = 0
    return formatter.string(from: NSNumber(value: n)) ?? String(n)
  }

  /// The app's day header pattern, `DateFormat('EEE, MMM d', locale)`
  /// (`dashboard_screen.dart`): "Wed, Nov 4".
  func dateHeader(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.locale = locale
    formatter.calendar = .gregorian
    formatter.timeZone = .current
    formatter.dateFormat = "EEE, MMM d"
    return formatter.string(from: date)
  }

  /// Fill a `{name}` template from the app's l10n files.
  static func fill(_ template: String, _ values: [String: String]) -> String {
    values.reduce(template) { text, pair in
      text.replacingOccurrences(of: "{\(pair.key)}", with: pair.value)
    }
  }
}
