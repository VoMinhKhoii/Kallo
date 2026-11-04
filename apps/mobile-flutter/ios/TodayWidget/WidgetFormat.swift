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

/// The calorie dial's three lines, worded as the app's `CalorieDial` does for
/// the "eaten" framing: the figure is what was eaten, and the detail under the
/// arc says what is left — or, past target, by how much it went over.
struct CalorieWording: Equatable {
  let figure: String
  let unit: String
  let detail: String
  let isOver: Bool

  init(eaten: Int, target: Int, atLeast: Bool, long: Bool,
       copy: TodaySnapshot.Copy, format: WidgetFormat) {
    // A floor on what was eaten (or over) is a ceiling on what is left.
    let eatenText = (atLeast ? "≥" : "") + format.count(eaten)
    let targetText = format.count(target)
    let left = target - eaten
    figure = eatenText
    isOver = left < 0
    guard long else {
      // The short dial's detail is the bare fraction for every state.
      unit = copy.eatenShort
      detail = WidgetFormat.fill(copy.fraction, ["logged": eatenText, "target": targetText])
      return
    }
    unit = copy.kcalEaten
    detail =
      left >= 0
      ? WidgetFormat.fill(
        copy.leftOfTarget,
        ["left": (atLeast ? "≤" : "") + format.count(left), "target": targetText])
      : WidgetFormat.fill(
        copy.overTargetBy,
        ["over": (atLeast ? "≥" : "") + format.count(-left), "target": targetText])
  }
}
