import WidgetKit

struct TodayEntry: TimelineEntry {
  let date: Date
  /// The day as it should be shown at `date`; nil before the app has ever
  /// written one.
  let day: TodaySnapshot?
  /// How tall the dial row may be: the small / medium widget's height on this
  /// phone. The large widget draws the medium's row, so it must not size the
  /// dials from its own, much taller, box.
  let rowHeight: Double
  /// The look for `date`'s hour, decided once per entry.
  let theme: WidgetTheme
}

/// Reads the app's snapshot and lays out the next day of entries: one now,
/// one at each theme switch (06:00, 18:00) and one at every local midnight,
/// so the date, the theme and an empty new day all change on time with the
/// app closed. The app asks for a reload after every change it writes.
struct TodayTimeline: TimelineProvider {
  func placeholder(in context: Context) -> TodayEntry {
    let now = Date()
    return TodayEntry(
      date: now, day: nil, rowHeight: Self.rowHeight(context), theme: WidgetTheme.at(now))
  }

  func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
    completion(
      Self.entry(at: Date(), snapshot: TodaySnapshotStore.read(), rowHeight: Self.rowHeight(context)))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
    let now = Date()
    let snapshot = TodaySnapshotStore.read()
    let row = Self.rowHeight(context)
    let dates = [now] + Self.boundaries(after: now)
    completion(
      Timeline(
        entries: dates.map { Self.entry(at: $0, snapshot: snapshot, rowHeight: row) },
        // Ask again after the last boundary, a day from now.
        policy: .atEnd))
  }

  static func entry(at date: Date, snapshot: TodaySnapshot?, rowHeight: Double) -> TodayEntry {
    TodayEntry(
      date: date, day: snapshot?.shown(on: TodaySnapshotStore.dayKey(date)), rowHeight: rowHeight,
      theme: WidgetTheme.at(date))
  }

  private static let rowHeightKey = "today.rowHeight"

  /// The small widget's side on this phone, which is also the medium's height.
  ///
  /// WidgetKit only reports the size of the family it is asking about, so a
  /// small or medium request remembers its height for the large one. Until one
  /// has been asked for, the large estimates it from its width, which it shares
  /// with the medium: two small sides and the ~25pt column gap of the home grid.
  static func rowHeight(_ context: Context) -> Double {
    let size = context.displaySize
    let defaults = UserDefaults.standard
    guard context.family == .systemLarge else {
      defaults.set(Double(size.height), forKey: rowHeightKey)
      return Double(size.height)
    }
    let known = defaults.double(forKey: rowHeightKey)
    return known > 0 ? known : (Double(size.width) - 25) / 2
  }

  /// Every theme switch and midnight in the 24 hours after `now`, in order.
  static func boundaries(after now: Date, calendar: Calendar = .gregorian) -> [Date] {
    let hours = [0, WidgetTheme.lightFrom, WidgetTheme.lightUntil]
    let today = calendar.startOfDay(for: now)
    let candidates = (0...1).flatMap { offset -> [Date] in
      guard let day = calendar.date(byAdding: .day, value: offset, to: today) else { return [] }
      return hours.compactMap { calendar.date(bySettingHour: $0, minute: 0, second: 0, of: day) }
    }
    let end = now.addingTimeInterval(24 * 60 * 60)
    return candidates.filter { $0 > now && $0 <= end }.sorted()
  }
}
