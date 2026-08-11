import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../theme/calm_tokens.dart';
import '../../../models/nutrition.dart';
import '../../../theme/nham_theme.dart';
import '../logic/helpers.dart';

/// The two calorie averages (complete + all) stacked as a hero + subtle
/// secondary. On [scope] change the parent rebuilds and the two entries glide
/// between the hero and sub slots (position) while morphing size/colour —
/// a buttery "switch places". The inactive (sub) entry is tappable to promote it.
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
  });

  final CalorieAverages averages;
  final NutritionDayScope scope;
  final String locale;
  final ValueChanged<NutritionDayScope> onScopeChange;

  /// The dates each figure covers, shown under it.
  final String dateSpan;

  /// The tapped column's calories. The two day scopes describe how to average a
  /// RANGE, so one bucket has neither — it shows a single figure and the swap
  /// goes away rather than offering a choice that would change nothing.
  final double? selectedValue;
  final bool hasSelection;

  /// A week bucket's figure is still a per-day average; a day's is a total.
  final bool isWeekBucket;

  static const Duration _dur = Duration(milliseconds: 320);
  static const Curve _curve = Curves.easeOutCubic;
  static const double _heroTop = 0;
  static const double _subTop = 62;

  void _select(NutritionDayScope next) {
    HapticFeedback.selectionClick();
    onScopeChange(next);
  }

  @override
  Widget build(BuildContext context) {
    if (hasSelection) {
      return SizedBox(
        height: 62,
        child: Stack(
          children: [
            _entry(
              data: CalorieScopeAverage(averagePerDay: selectedValue, days: 1),
              unitKey: isWeekBucket
                  ? 'nutrition.rhythm.kcalPerLoggedDay'
                  : 'nutrition.rhythm.calories',
              active: true,
              onPromote: () {},
            ),
          ],
        ),
      );
    }

    final completeActive = scope == NutritionDayScope.complete;
    return SizedBox(
      height: 100,
      child: Stack(
        children: [
          _entry(
            data: averages.complete,
            unitKey: 'nutrition.rhythm.kcalPerCompleteDay',
            active: completeActive,
            onPromote: () => _select(NutritionDayScope.complete),
          ),
          _entry(
            data: averages.all,
            unitKey: 'nutrition.rhythm.kcalPerLoggedDay',
            active: !completeActive,
            onPromote: () => _select(NutritionDayScope.all),
          ),
        ],
      ),
    );
  }

  Widget _entry({
    required CalorieScopeAverage data,
    required String unitKey,
    required bool active,
    required VoidCallback onPromote,
  }) {
    final numberStyle = active
        ? dashHero()
        : dashHero(color: kInkMuted).copyWith(
            fontSize: 20,
            letterSpacing: -0.5,
          );
    final valueText = data.averagePerDay != null
        ? formatLocalizedNumber(data.averagePerDay!, locale)
        : '—';

    return AnimatedPositioned(
      duration: _dur,
      curve: _curve,
      top: active ? _heroTop : _subTop,
      left: 0,
      right: 0,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: active ? null : onPromote,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              mainAxisSize: MainAxisSize.min,
              children: [
                AnimatedDefaultTextStyle(
                  duration: _dur,
                  curve: _curve,
                  style: numberStyle,
                  child: Text(valueText),
                ),
                const SizedBox(width: NhamSpacing.sp2),
                // The unit carries the denominator — "kcal per complete day" —
                // so the figure is never a bare number needing a caption.
                Flexible(
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 2),
                    child: Text(
                      tr(unitKey),
                      style: dashBody(color: kInkMuted),
                    ),
                  ),
                ),
                if (!active) ...[
                  const SizedBox(width: NhamSpacing.sp1),
                  const Icon(
                    LucideIcons.arrowUpDown300,
                    size: 12,
                    color: kInkMuted,
                  ),
                ],
              ],
            ),
            const SizedBox(height: 2),
            Text(dateSpan, style: dashMeta(color: kInkMuted)),
          ],
        ),
      ),
    );
  }
}

