/// The week of rings beside the Log feed in a two-pane window: which days
/// the heatmap covers, which days a week holds, how far it pages, and how
/// full a day's ring is.
///
/// Pure, so the week maths is tested without a widget. The rules follow the
/// web calendar (`components/logging/sidebar/calendar/`): weeks start on
/// Monday, a day past today is not a day you can open, and a ring is drawn
/// only for a day whose total and target are both known.
library;

import '../../../../models/profile/heatmap.dart';
import '../meal_utils.dart' show partialDayFraction;
import '../timeline_utils.dart';

/// Every day of [data] up to [today], newest first.
///
/// The grid pads its first and last weeks with `outside` and `future` cells
/// so its columns stay whole. Those are not days the data covers.
List<HeatmapCell> pastDays(HeatmapData data, String today) {
  final days = [
    for (final row in data.cells)
      for (final cell in row)
        if (cell.status != HeatmapCellStatus.future &&
            cell.status != HeatmapCellStatus.outside &&
            cell.date.compareTo(today) <= 0)
          cell,
  ];
  days.sort((a, b) => b.date.compareTo(a.date));
  return days;
}

/// A day measured against its target: the web's `measureDay`.
class DayMeasure {
  const DayMeasure({required this.fraction, required this.met});

  /// Share of the target eaten; over target runs past 1.
  final double fraction;

  /// Past the completeness floor, where the ring turns green.
  final bool met;
}

/// Null when there is nothing to measure: no target, or no known total.
/// Drawing an arc for those would be inventing a number.
DayMeasure? measureDay(double? kcal, int? target) {
  if (kcal == null || target == null || target <= 0) return null;
  return DayMeasure(
    fraction: kcal / target,
    met: kcal >= partialDayFraction * target,
  );
}

/// The Monday of the week holding [date].
DateTime weekOf(String date) {
  final d = dateStringToDate(date);
  return DateTime(d.year, d.month, d.day - (d.weekday - DateTime.monday));
}

/// [week] moved by [delta] weeks.
DateTime shiftWeek(DateTime week, int delta) =>
    DateTime(week.year, week.month, week.day + 7 * delta);

/// The seven days of the week that starts on [week], Monday first.
List<String> weekDates(DateTime week) => [
  for (var i = 0; i < 7; i++)
    dateToDateString(DateTime(week.year, week.month, week.day + i)),
];

/// Whether the data covers the whole week before [week].
///
/// The covered days run unbroken from the oldest one to today, so the oldest
/// alone answers it. A week the data only reaches into would draw its
/// earlier days as empty when nobody knows what they hold, so it is not
/// offered. No data yet means nothing to page back to.
bool canShowPreviousWeek(DateTime week, List<HeatmapCell>? days) {
  if (days == null || days.isEmpty) return false;
  final oldest = days.last.date;
  return oldest.compareTo(dateToDateString(shiftWeek(week, -1))) <= 0;
}

/// Whether a week after [week] has begun by [today].
bool canShowNextWeek(DateTime week, String today) =>
    week.isBefore(weekOf(today));
