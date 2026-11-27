import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';

import '../../../../shared/logic/display_format.dart';
import '../../../../shared/widgets/nutrition/macro_legend.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../logic/days/this_week.dart';
import '../../logic/format.dart';
import '../../logic/timeline_utils.dart';

/// One of this week's days under the calendar: its name, then its macros and
/// calories laid out as a meal card's bottom row ([MacroLegend], the kcal at
/// its right). The selected day sits on the beige wash.
///
/// Every line keeps its height whether or not the day has arrived, so rows
/// do not jump as their days load one after another.
class LogDayRow extends StatelessWidget {
  const LogDayRow({
    super.key,
    required this.date,
    required this.today,
    required this.totals,
    required this.fallbackKcal,
    required this.selected,
    required this.onTap,
    this.variant = LogDayRowVariant.plain,
  });

  final String date;
  final String today;

  /// The day as the feed loads it; null until it arrives.
  final DayTotals? totals;

  /// The day's calories from the calendar's data, shown until [totals]
  /// arrives.
  final double? fallbackKcal;
  final bool selected;
  final VoidCallback onTap;
  final LogDayRowVariant variant;

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
    final scaler = MediaQuery.textScalerOf(context);
    final t = totals;
    final kcal = t != null ? t.kcal : fallbackKcal;
    final nothing = t != null && t.empty;
    final kcalText = kcal == null ? null : fmtKcal(kcal, locale: locale);

    final grams = {
      if (t?.protein != null) 'protein': 'P ${fmtG(t!.protein)}',
      if (t?.carbs != null) 'carbohydrate': 'C ${fmtG(t!.carbs)}',
      if (t?.fat != null) 'fat': 'F ${fmtG(t!.fat)}',
    };
    final kcalLabel =
        kcalText == null
            ? null
            : Text(kcalText, style: dashBody(tabular: true));
    // Until the day's macros arrive the calories already sit where the
    // legend will put them, at the right.
    final Widget figures =
        nothing
            ? Text(tr('logging.days.nothingLogged'), style: dashMeta())
            : grams.isEmpty
            ? Align(
              alignment: Alignment.centerRight,
              child: kcalLabel ?? const SizedBox.shrink(),
            )
            : MacroLegend(gramLabels: grams, trailing: kcalLabel);

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
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: selected ? KalloColors.hover : null,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(label, maxLines: 1, style: dashBody()),
              const SizedBox(height: 2),
              SizedBox(
                height: scaler.scale(kDashBodySize) * kDashBodyLeading,
                child: Align(alignment: Alignment.centerLeft, child: figures),
              ),
              if (variant == LogDayRowVariant.withMeals) ...[
                const SizedBox(height: 2),
                SizedBox(
                  height: scaler.scale(kDashMetaSize) * kDashMetaLeading,
                  child: Text(
                    t == null ? '' : joinTyped(t.typed),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: dashMeta(),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
