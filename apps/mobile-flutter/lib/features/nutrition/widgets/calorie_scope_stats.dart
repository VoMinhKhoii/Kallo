import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../models/nutrition.dart';
import '../../../theme/nham_theme.dart';
import '../logic/helpers.dart';
import 'scope_switch.dart';

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
    this.isEmpty = false,
    this.diff,
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

  /// Nothing logged in the range. Both scopes read "—", so the switch would be
  /// a choice between two blanks — show the logged-day figure alone.
  final bool isEmpty;

  /// Signed kcal against the calorie goal, or null when there is no goal. It
  /// annotates the figure, so it sits on the figure's caption line rather than
  /// in the corner the switch now occupies.
  final double? diff;

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

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // The figure leads, top-left; the switch takes the opposite corner.
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    value != null ? formatLocalizedNumber(value, locale) : '—',
                    style: dashHero(),
                  ),
                  const SizedBox(width: NhamSpacing.sp2),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 2),
                    child: Text(
                      tr('nutrition.rhythm.calories'),
                      style: dashBody(color: kInkMuted),
                    ),
                  ),
                ],
              ),
            ),
            if (showSwitch)
              Transform.translate(
                offset: const Offset(NhamSpacing.sp2, -NhamSpacing.sp1),
                child: ScopeSwitch(onComplete: onComplete, onTap: _toggle),
              ),
          ],
        ),
        const SizedBox(height: 2),
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Expanded(
              child: Text(dateSpan, style: dashMeta(color: kInkMuted)),
            ),
            if (diff != null) _CalorieTarget(diff: diff!, locale: locale),
          ],
        ),
      ],
    );
  }
}

/// The signed gap to the calorie goal — the arrow shows direction, the number
/// how many kcal over or under.
class _CalorieTarget extends StatelessWidget {
  const _CalorieTarget({required this.diff, required this.locale});

  final double diff;
  final String locale;

  @override
  Widget build(BuildContext context) {
    final over = diff >= 0;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          over ? LucideIcons.arrowUp300 : LucideIcons.arrowDown300,
          size: 15,
          color: kInkMuted,
        ),
        const SizedBox(width: 2),
        Text(
          '${formatLocalizedNumber(diff.abs(), locale)} '
          '${tr('nutrition.rhythm.calories')}',
          style: dashMeta(color: kInkMuted, tabular: true),
        ),
      ],
    );
  }
}
