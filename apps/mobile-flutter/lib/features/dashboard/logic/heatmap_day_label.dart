/// What a heatmap day's bubble says: its date and kcal. The cell's colour
/// already says how the day went.
///
/// Twin of web `components/dashboard/heatmap-day/heatmap-day-label.tsx`.
library;

import 'package:intl/intl.dart';

import '../../../models/profile/heatmap.dart';
import '../../logging/logic/format.dart';

/// "Tue, Oct 20 · 1,240 kcal" — kcal only when something was logged.
String heatmapDayHeading(HeatmapCell cell, String locale) {
  final day = DateFormat.MMMEd(locale).format(DateTime.parse(cell.date));
  final calories = cell.calories;
  if (calories == null) return day;
  return '$day · ${fmtKcal(calories, locale: locale)}';
}
