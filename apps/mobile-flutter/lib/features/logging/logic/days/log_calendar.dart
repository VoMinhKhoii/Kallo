/// The month calendar beside the Log feed in a two-pane window: which days
/// the heatmap covers, how a month lays out, how far it pages, and how full a
/// day's ring is.
///
/// Pure, so the month maths is tested without a widget. The rules follow the
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

/// The first day of the month holding [date].
DateTime monthOf(String date) {
  final d = dateStringToDate(date);
  return DateTime(d.year, d.month);
}

/// [month] moved by [delta] months.
DateTime shiftMonth(DateTime month, int delta) =>
    DateTime(month.year, month.month + delta);

/// [month]'s grid, Monday first: a null for each blank before the 1st, then
/// one YYYY-MM-DD per day. The last row is left short, as the web leaves it.
List<String?> monthCells(DateTime month) {
  final first = DateTime(month.year, month.month);
  final blanks = first.weekday - DateTime.monday;
  final days = DateTime(month.year, month.month + 1, 0).day;
  return [
    for (var i = 0; i < blanks; i++) null,
    for (var d = 1; d <= days; d++)
      dateToDateString(DateTime(month.year, month.month, d)),
  ];
}

/// Whether the month before [month] holds a day the data covers.
///
/// The covered days run unbroken from the oldest one to today, so the oldest
/// alone answers it. No data yet means nothing to page back to.
bool canShowPreviousMonth(DateTime month, List<HeatmapCell>? days) {
  if (days == null || days.isEmpty) return false;
  final oldest = days.last.date;
  return oldest.compareTo(dateToDateString(month)) < 0;
}

/// Whether a month after [month] has begun by [today].
bool canShowNextMonth(DateTime month, String today) =>
    month.isBefore(monthOf(today));

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
