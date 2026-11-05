import Foundation

/// What the app hands the widget: one JSON string in the shared App Group.
///
/// Written by `lib/features/today_widget/` (Dart) after anything changes
/// today's meals or targets, through the `home_widget` package. The
/// widget never calls the network and never formats a sentence of its own:
/// every word arrives here, in the language the user chose in Kallo.
struct TodaySnapshot: Codable, Equatable {
  struct Macros: Codable, Equatable {
    let kcal: Int
    let protein: Int
    let carbs: Int
    let fat: Int

    static let zero = Macros(kcal: 0, protein: 0, carbs: 0, fat: 0)
  }

  struct Meal: Codable, Equatable {
    /// Already formatted, 24-hour in every language ("8:12", "19:05").
    let time: String
    let text: String
    /// "380 kcal" — formatted by the app.
    let kcal: String
  }

  /// The app's own wording (`assets/l10n/<locale>.json`), resolved by the app.
  struct Copy: Codable, Equatable {
    let kcalEaten: String
    let eatenShort: String
    /// "{left}/{target} left"
    let leftOfTarget: String
    /// "{over} over {target}"
    let overTargetBy: String
    /// "{logged}/{target}" — the short dial's bare fraction.
    let fraction: String
    let protein: String
    let carbs: String
    let fat: String
    let signedOut: String
  }

  /// Bumped when the shape changes; a widget reading another version shows the
  /// signed-out card rather than guessing.
  static let version = 1

  let v: Int
  /// The local day the totals belong to, `yyyy-MM-dd`.
  let date: String
  /// "en" or "vi" — the language chosen in Kallo, not the phone's.
  let locale: String
  let signedIn: Bool
  let target: Macros
  let eaten: Macros
  /// Totals that left out a meal's unknown value: "kcal", "protein", "carbs",
  /// "fat". Each reads as a floor ("≥").
  let floors: [String]
  /// Today's meals, oldest first.
  let meals: [Meal]
  let copy: Copy

  /// The day as it should be SHOWN on `day`: a snapshot written on an earlier
  /// date is a new, empty day with the same targets — never yesterday's meals.
  func shown(on day: String) -> TodaySnapshot {
    guard day != date else { return self }
    return TodaySnapshot(
      v: v, date: day, locale: locale, signedIn: signedIn, target: target,
      eaten: .zero, floors: [], meals: [], copy: copy)
  }
}

enum TodaySnapshotStore {
  /// Shared with the app (`kTodayWidgetAppGroup` in Dart, which `home_widget`
  /// writes through): `Runner.entitlements` and `TodayWidget.entitlements`
  /// both carry it, and both App IDs need it in the developer portal.
  static let appGroup = "group.com.khoivo.nham"
  static let key = "today.snapshot"

  static func read(_ defaults: UserDefaults? = UserDefaults(suiteName: appGroup))
    -> TodaySnapshot?
  {
    guard let json = defaults?.string(forKey: key), let data = json.data(using: .utf8),
      let snapshot = try? JSONDecoder().decode(TodaySnapshot.self, from: data),
      snapshot.v == TodaySnapshot.version
    else { return nil }
    return snapshot
  }

  /// `yyyy-MM-dd` for `date` in the phone's current time zone — the same key
  /// the app's `todayDateString()` builds.
  static func dayKey(_ date: Date, calendar: Calendar = .gregorian) -> String {
    let c = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
  }
}

extension Calendar {
  /// Gregorian in the phone's time zone: Dart's `DateTime` is always
  /// Gregorian, so a phone set to the Buddhist calendar must not shift the year
  /// the two sides key the day on.
  static var gregorian: Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = .current
    return calendar
  }
}
