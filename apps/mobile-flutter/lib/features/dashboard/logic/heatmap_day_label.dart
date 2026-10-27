/// What a heatmap day says about itself: its date and kcal, then its status.
///
/// Twin of web `components/dashboard/heatmap-day/heatmap-day-label.tsx`.
library;

import 'package:easy_localization/easy_localization.dart';

import '../../../models/profile/heatmap.dart';
import '../../logging/logic/format.dart';
import 'heatmap_colors.dart';

/// "Tue, Oct 20 · 1,240 kcal" — kcal only when something was logged.
String heatmapDayHeading(HeatmapCell cell, String locale) {
  final day = DateFormat(
    'EEE, MMM d',
    locale,
  ).format(DateTime.parse(cell.date));
  final calories = cell.calories;
  if (calories == null) return day;
  return '$day · ${fmtKcal(calories, locale: locale)}';
}

String heatmapDayStatus(HeatmapCell cell) {
  switch (cell.status) {
    case HeatmapCellStatus.future:
      return tr('dashboard.adherenceHeatmap.future');
    case HeatmapCellStatus.outside:
      return tr('dashboard.adherenceHeatmap.outside');
    case HeatmapCellStatus.partial:
      return tr('dashboard.adherenceHeatmap.partial');
    case HeatmapCellStatus.unlogged:
      return tr('dashboard.adherenceHeatmap.notLogged');
    case HeatmapCellStatus.logged:
      if (cell.ratio == null) {
        return tr('dashboard.adherenceHeatmap.notLogged');
      }
      if (cell.hasCheatMeal) {
        return tr('dashboard.adherenceHeatmap.cheatDay');
      }
      final labelKey = heatmapTierFor(cell.ratio).name;
      final pct = (cell.ratio! * 100).round();
      return '${tr('dashboard.adherenceHeatmap.$labelKey')} · $pct%';
  }
}
