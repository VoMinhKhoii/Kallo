/// The five slices of the day the app speaks in. Ported 1:1 from the web
/// `lib/domain/logging/empty-prompt.ts` — the composer's serif prompt and the
/// surface-state cast's sleeping pose both key off the same table, so they must
/// agree about when the night starts.
enum TimeOfDayBucket { morning, lunch, afternoon, evening, lateNight }

/// Which bucket [hour] (0–23) falls in. Late night is the wrap-around case:
/// everything from 22:00 until breakfast starts.
TimeOfDayBucket bucketForHour(int hour) {
  if (hour >= 5 && hour < 11) return TimeOfDayBucket.morning;
  if (hour >= 11 && hour < 15) return TimeOfDayBucket.lunch;
  if (hour >= 15 && hour < 18) return TimeOfDayBucket.afternoon;
  if (hour >= 18 && hour < 22) return TimeOfDayBucket.evening;
  return TimeOfDayBucket.lateNight;
}

/// True from 22:00 through 04:59 — the window where the cast sleeps.
bool isLateNight(int hour) => bucketForHour(hour) == TimeOfDayBucket.lateNight;
