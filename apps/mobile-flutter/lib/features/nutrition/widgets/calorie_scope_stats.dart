import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../models/nutrition.dart';
import '../../../theme/kallo_theme.dart';
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

  /// Signed kcal against the SAME-LENGTH window before this one, or null when
  /// there is nothing back there to compare with. It qualifies the figure, so
  /// it reads immediately after the unit.
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
                  // Shrink-to-fit, never ellipsis: a truncated kcal figure is
                  // a plausible-looking wrong number. At a large text scale or
                  // five digits plus a delta this row would otherwise clip.
                  Flexible(
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Text(
                        value != null
                            ? formatLocalizedNumber(value, locale)
                            : '—',
                        style: dashHero(),
                        maxLines: 1,
                        softWrap: false,
                      ),
                    ),
                  ),
                  const SizedBox(width: KalloSpacing.sp2),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 2),
                    child: Text(
                      tr('nutrition.rhythm.calories'),
                      style: dashBody(color: kInkMuted),
                    ),
                  ),
                  if (diff != null) ...[
                    const SizedBox(width: KalloSpacing.sp2),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 2),
                      child: _CalorieDelta(diff: diff!, locale: locale),
                    ),
                  ],
                ],
              ),
            ),
            if (showSwitch)
              Transform.translate(
                offset: const Offset(KalloSpacing.sp2, -KalloSpacing.sp1),
                child: ScopeSwitch(onComplete: onComplete, onTap: _toggle),
              ),
          ],
        ),
        const SizedBox(height: 2),
        Text(dateSpan, style: dashMeta(color: kInkMuted)),
      ],
    );
  }
}

/// The signed gap to the window before this one — the arrow shows direction,
/// the number how many kcal up or down.
class _CalorieDelta extends StatelessWidget {
  const _CalorieDelta({required this.diff, required this.locale});

  final double diff;
  final String locale;

  @override
  Widget build(BuildContext context) {
    final over = diff >= 0;
    // The arrow is the only thing distinguishing +120 from -120, and an Icon
    // carries no label — without this both read the same aloud.
    return Semantics(
      label: '${tr(over ? 'nutrition.rhythm.diffUp' : 'nutrition.rhythm.diffDown')} '
          '${formatLocalizedNumber(diff.abs(), locale)}',
      excludeSemantics: true,
      child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          over ? LucideIcons.arrowUp300 : LucideIcons.arrowDown300,
          size: 15,
          color: kInkMuted,
        ),
        const SizedBox(width: 2),
        Text(
          formatLocalizedNumber(diff.abs(), locale),
          style: dashMeta(color: kInkMuted, tabular: true),
        ),
      ],
      ),
    );
  }
}
