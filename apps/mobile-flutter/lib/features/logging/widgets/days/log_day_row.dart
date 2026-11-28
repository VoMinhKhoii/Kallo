import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

import '../../../../shared/logic/display_format.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../logic/days/this_week.dart';
import '../../logic/format.dart';
import '../../logic/timeline_utils.dart';
import 'log_day_figures.dart';

/// One day of the week under its rings, read as a table row: the day's name,
/// its three macros each in a column of its own, then its calories at the
/// right. Where the columns do not fit on one line (large text, a narrow
/// pane) the macros drop under the name and keep their columns. A day with
/// nothing logged shows its name alone. The selected day sits on the beige
/// wash; a day that has not come yet is dimmed and has no tap.
///
/// A row keeps its height whether or not its day has arrived, so rows do not
/// jump as their days load one after another.
class LogDayRow extends StatelessWidget {
  const LogDayRow({
    super.key,
    required this.date,
    required this.today,
    required this.totals,
    required this.fallbackKcal,
    required this.selected,
    required this.onTap,
    this.isFuture = false,
    this.minHeight = 0,
  });

  /// The row is at least this tall, its line centred in it: the week's rows
  /// share the height of their pane.
  final double minHeight;

  final String date;
  final String today;

  /// The day as the feed loads it; null until it arrives.
  final DayTotals? totals;

  /// The day's calories from the heatmap, shown until [totals] arrives.
  final double? fallbackKcal;
  final bool selected;
  final bool isFuture;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final locale = localeOf(context);
    final label =
        date == today
            ? tr('logging.timelineSidebar.todayLabel')
            : date == addDays(today, -1)
            ? tr('logging.timelineSidebar.yesterdayLabel')
            : DateFormat(
              tr('logging.days.dayFormat'),
              locale,
            ).format(dateStringToDate(date));
    final t = isFuture ? null : totals;
    final kcal = isFuture ? null : (t != null ? t.kcal : fallbackKcal);
    final nothing = t != null && t.empty;
    final kcalText = kcal == null ? null : fmtKcal(kcal, locale: locale);
    final row = Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
      constraints: BoxConstraints(minHeight: minHeight),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: selected ? KalloColors.hover : null,
        borderRadius: BorderRadius.circular(14),
      ),
      child: LogDayFigures(
        name: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: dashBody(color: isFuture ? KalloColors.stone50 : null),
        ),
        grams: {
          if (t?.protein != null) 'protein': 'P ${fmtG(t!.protein)}',
          if (t?.carbs != null) 'carbohydrate': 'C ${fmtG(t!.carbs)}',
          if (t?.fat != null) 'fat': 'F ${fmtG(t!.fat)}',
        },
        kcal: nothing ? null : kcalText,
        widestKcal: fmtKcal(8888, locale: locale),
      ),
    );
    if (isFuture) {
      return Semantics(label: label, excludeSemantics: true, child: row);
    }
    return Semantics(
      button: true,
      selected: selected,
      label: [
        label,
        if (kcalText != null) kcalText,
        if (nothing) tr('logging.days.nothingLogged'),
      ].join(', '),
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          HapticFeedback.selectionClick();
          onTap();
        },
        child: row,
      ),
    );
  }
}
