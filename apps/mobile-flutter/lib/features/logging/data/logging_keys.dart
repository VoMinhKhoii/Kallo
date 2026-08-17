/// React-Query-style cache keys for the logging surface — replicated EXACTLY
/// from web `lib/domain/meals/query-keys.ts` so prefix-matching invalidation
/// behaves the same. The day query uses the 4-element [byUserDateOffset];
/// invalidations use the 3-element [byUserDate] and rely on prefix matching —
/// never exact.
library;

abstract final class LoggingDayKeys {
  static const List<Object?> all = ['logging-day'];

  static List<Object?> byUserDate(String userId, String date) => [
    'logging-day',
    userId,
    date,
  ];

  static List<Object?> byUserDateOffset(
    String userId,
    String date,
    int timezoneOffset,
  ) => ['logging-day', userId, date, timezoneOffset];
}

/// `['meal-dates', userId, timezoneOffset]`. Invalidations elsewhere use the
/// `['meal-dates']` prefix — never exact.
List<Object?> mealDatesKey(String userId, int timezoneOffset) => [
  'meal-dates',
  userId,
  timezoneOffset,
];

/// Profile cache key — mirrors RN `onboardingKeys.profile`.
const List<Object?> onboardingProfileKey = ['onboarding', 'profile'];

/// Local YYYY-MM-DD (matches the web's `todayDateString`).
String todayDateString([DateTime? date]) {
  final d = date ?? DateTime.now();
  final m = d.month.toString().padLeft(2, '0');
  final day = d.day.toString().padLeft(2, '0');
  return '${d.year}-$m-$day';
}

/// Local YYYY-MM-DD `delta` days from [date] (matches the web's `addDays`).
String addDays(String date, int delta) {
  final parts = date.split('-');
  final base = DateTime(
    int.parse(parts[0]),
    int.parse(parts[1]),
    int.parse(parts[2]),
  );
  return todayDateString(DateTime(base.year, base.month, base.day + delta));
}

/// Local timezone offset in MINUTES, matching JS `Date.getTimezoneOffset()`
/// (minutes BEHIND UTC, i.e. `-(localOffsetMinutes)`).
int timezoneOffsetMinutes([DateTime? date]) {
  final d = date ?? DateTime.now();
  return -d.timeZoneOffset.inMinutes;
}
