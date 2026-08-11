import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../models/nutrition.dart';
import '../../../theme/nham_theme.dart';
import '../logic/helpers.dart';

/// One calorie figure, and a switch that NAMES the other one.
///
/// The two averages used to sit stacked, the inactive one small underneath with
/// an up/down glyph — which showed the number but never said the control was a
/// control, or what tapping it would give you. Now the card shows the scope you
/// are on and offers the other by name, with the arrow pointing the way it
/// moves. Mirror of web `CalorieScopeStats` (keep in sync).
class CalorieScopeStats extends StatelessWidget {
  const CalorieScopeStats({
    super.key,
    required this.averages,
    required this.scope,
    required this.locale,
    required this.onScopeChange,
    required this.dateSpan,
    this.selectedValue,
    this.hasSelection = false,
    this.isWeekBucket = false,
    this.isEmpty = false,
  });

  final CalorieAverages averages;
  final NutritionDayScope scope;
  final String locale;
  final ValueChanged<NutritionDayScope> onScopeChange;

  /// The dates the figure covers, shown under it.
  final String dateSpan;

  /// The tapped column's calories. The two day scopes describe how to average a
  /// RANGE, so one bucket has neither — it shows a single figure and the switch
  /// goes away rather than offering a choice that would change nothing.
  final double? selectedValue;
  final bool hasSelection;

  /// A week bucket's figure is still a per-day average; a day's is a total.
  final bool isWeekBucket;

  /// Nothing logged in the range. Both scopes read "—", so the switch would be
  /// a choice between two blanks — show the logged-day figure alone.
  final bool isEmpty;

  void _toggle() {
    HapticFeedback.selectionClick();
    onScopeChange(scope == NutritionDayScope.complete
        ? NutritionDayScope.all
        : NutritionDayScope.complete);
  }

  @override
  Widget build(BuildContext context) {
    final onComplete = scope == NutritionDayScope.complete;
    final showSwitch = !hasSelection && !isEmpty;

    final double? value;
    if (hasSelection) {
      value = selectedValue;
    } else if (isEmpty) {
      value = averages.all.averagePerDay;
    } else {
      value = averages.forScope(scope).averagePerDay;
    }

    final String unitKey;
    if (hasSelection) {
      unitKey = isWeekBucket
          ? 'nutrition.rhythm.kcalPerLoggedDay'
          : 'nutrition.rhythm.calories';
    } else if (isEmpty || !onComplete) {
      unitKey = 'nutrition.rhythm.kcalPerLoggedDay';
    } else {
      unitKey = 'nutrition.rhythm.kcalPerCompleteDay';
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (showSwitch)
          Align(
            alignment: Alignment.centerRight,
            child: _ScopeSwitch(onComplete: onComplete, onTap: _toggle),
          ),
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Text(
              value != null ? formatLocalizedNumber(value, locale) : '—',
              style: dashHero(),
            ),
            const SizedBox(width: NhamSpacing.sp2),
            // The unit carries the denominator — "kcal per complete day" — so
            // the figure is never a bare number needing a caption.
            Flexible(
              child: Padding(
                padding: const EdgeInsets.only(bottom: 2),
                child: Text(tr(unitKey), style: dashBody(color: kInkMuted)),
              ),
            ),
          ],
        ),
        const SizedBox(height: 2),
        Text(dateSpan, style: dashMeta(color: kInkMuted)),
      ],
    );
  }
}

/// The switch names the scope it moves TO, and the arrow points that way:
/// complete days sit to the left of logged days.
class _ScopeSwitch extends StatelessWidget {
  const _ScopeSwitch({required this.onComplete, required this.onTap});

  final bool onComplete;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final label = tr(onComplete
        ? 'nutrition.rhythm.loggedDays'
        : 'nutrition.rhythm.completeDays');
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: NhamSpacing.sp2,
            vertical: NhamSpacing.sp1,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (!onComplete) ...[
                const Icon(LucideIcons.arrowLeft300, size: 14,
                    color: kInkMuted),
                const SizedBox(width: 6),
              ],
              Text(
                label,
                style: dashMeta(color: kInkMuted)
                    .copyWith(fontWeight: FontWeight.w500),
              ),
              if (onComplete) ...[
                const SizedBox(width: 6),
                const Icon(LucideIcons.arrowRight300, size: 14,
                    color: kInkMuted),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
