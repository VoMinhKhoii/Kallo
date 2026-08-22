import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/profile/onboarding.dart';
import '../../../../shared/logic/display_format.dart' show formatCount;
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../../theme/kallo_typography.dart';

/// Daily-target card — a flat white surface showing the computed calorie
/// target, a "based on TDEE…" caption, and the selected split's macros.
/// Hierarchy comes from the hairline border, not an alpha gradient (matching
/// the dashboard token system: solid cards, one radius).
class DailyTargetCard extends StatelessWidget {
  const DailyTargetCard({
    super.key,
    required this.calorieTarget,
    required this.tdee,
    required this.goal,
    required this.macros,
  });

  final num calorieTarget;
  final int tdee;
  final String goal;
  final MacroTargets? macros;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.toString();
    final caption =
        StringBuffer()
          ..write(tr('onboarding.bodyMetrics.basedOnTdee'))
          ..write(
            ' ~${formatCount(tdee, locale)} ${tr('onboarding.bodyMetrics.kcal')}',
          );
    if (goal == 'maintaining') {
      caption.write(' · ${tr('onboarding.bodyMetrics.maintenance')}');
    } else {
      final sign = goal == 'cutting' ? '−' : '+';
      final delta = (tdee - calorieTarget).abs();
      final kind =
          goal == 'cutting'
              ? tr('onboarding.bodyMetrics.aggressionDeficit')
              : tr('onboarding.bodyMetrics.aggressionSurplus');
      caption.write(
        ' · $sign${formatCount(delta.round(), locale)} ${tr('onboarding.bodyMetrics.perDay')} $kind',
      );
    }

    final m = macros;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(KalloSpacing.sp5),
      decoration: BoxDecoration(
        color: KalloColors.elev,
        borderRadius: BorderRadius.circular(KalloRadii.containerLg),
        border: Border.all(color: KalloColors.inputBorder),
      ),
      child: Column(
        children: [
          Text(
            tr('onboarding.bodyMetrics.calorieTarget').toUpperCase(),
            textAlign: TextAlign.center,
            style: dashEyebrow(),
          ),
          const SizedBox(height: KalloSpacing.sp2),
          Text.rich(
            TextSpan(
              children: [
                TextSpan(text: formatCount(calorieTarget.round(), locale)),
                TextSpan(
                  text: ' ${tr('onboarding.bodyMetrics.kcal')}',
                  style: dashMeta(),
                ),
              ],
            ),
            style: KalloTextStyles.serifRegular(
              fontSize: 36,
            ).copyWith(color: KalloColors.text),
          ),
          const SizedBox(height: KalloSpacing.sp2),
          Text(
            caption.toString(),
            textAlign: TextAlign.center,
            style: dashMeta(),
          ),
          if (m != null) ...[
            const SizedBox(height: KalloSpacing.sp4),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _macroCell(tr('onboarding.bodyMetrics.protein'), m.proteinG),
                _macroCell(tr('onboarding.bodyMetrics.carbs'), m.carbsG),
                _macroCell(tr('onboarding.bodyMetrics.fat'), m.fatG),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _macroCell(String label, num grams) {
    return Column(
      children: [
        Text(label.toUpperCase(), style: dashEyebrow()),
        const SizedBox(height: 2),
        Text(
          '${grams.round()}${tr('onboarding.bodyMetrics.grams')}',
          style: dashValue(),
        ),
      ],
    );
  }
}
