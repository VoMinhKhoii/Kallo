import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/profile/onboarding.dart';
import '../../../../shared/logic/display_format.dart' show formatCount, localeOf;
import '../../../../shared/logic/macro_composition.dart';
import '../../../../shared/logic/tdee.dart';
import '../../../../shared/widgets/form/option_row.dart';
import '../../../../shared/widgets/nutrition/composition_bar.dart';
import '../../../../shared/widgets/typography/section_header_row.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import 'target_macro_rows.dart';

/// The reward at the end of the wizard: one white card carrying the day's
/// calories, its macro split, and the only control left to turn. The carb split
/// lives INSIDE the card because it is the card's own dial — every number above
/// it moves the moment a row is tapped.
class TargetCard extends StatelessWidget {
  const TargetCard({
    super.key,
    required this.macros,
    required this.carbSplit,
    required this.onCarbSplitChanged,
  });

  final MacroTargets macros;
  final String carbSplit;
  final ValueChanged<String> onCarbSplitChanged;

  static const double splitRowHeight = 48;
  static const double barHeight = 10; // fully rounded → radius 5

  static const List<({CarbSplit split, String key})> splits = [
    (split: CarbSplit.moderateCarb, key: 'onboarding.bodyMetrics.moderateCarb'),
    (split: CarbSplit.lowerCarb, key: 'onboarding.bodyMetrics.lowerCarb'),
    (split: CarbSplit.higherCarb, key: 'onboarding.bodyMetrics.higherCarb'),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(KalloSpacing.sp4),
      decoration: BoxDecoration(
        color: kCardSurface,
        borderRadius: BorderRadius.circular(KalloRadii.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _hero(context),
          const SizedBox(height: KalloSpacing.sp3),
          CompositionBar(
            height: barHeight,
            gap: 4,
            segments: compositionFromGrams((
              protein: macros.proteinG,
              carbohydrate: macros.carbsG,
              fat: macros.fatG,
            )).segments,
          ),
          const SizedBox(height: KalloSpacing.sp3),
          TargetMacroRows(macros: macros),
          const SizedBox(height: KalloSpacing.sp3),
          Container(height: 1, color: kHairline),
          const SizedBox(height: KalloSpacing.sp3),
          GroupLabel(tr('onboarding.bodyMetrics.carbSplit')),
          for (final option in splits) ...[
            const SizedBox(height: KalloSpacing.sp2),
            OptionRow(
              label: tr(option.key),
              note: _ratio(option.split),
              height: splitRowHeight,
              selected: carbSplit == carbSplitToString(option.split),
              onTap: () => onCarbSplitChanged(carbSplitToString(option.split)),
            ),
          ],
        ],
      ),
    );
  }

  /// The ONE hero number on this screen, with its unit as a meta suffix on the
  /// same baseline run. Scaled down rather than wrapped or ellipsized: both
  /// halves of "1,840 kcal/day" have to stay on one line for the baseline
  /// pairing to read, and a five-figure target at 1.3x on a 320pt phone runs
  /// past the card.
  Widget _hero(BuildContext context) => FittedBox(
        fit: BoxFit.scaleDown,
        alignment: Alignment.centerLeft,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Text(
              formatCount(macros.calories.round(), localeOf(context)),
              style: dashHero(),
            ),
            const SizedBox(width: KalloSpacing.sp2),
            Text(tr('onboarding.bodyMetrics.perDay'), style: dashMeta()),
          ],
        ),
      );

  /// Protein / fat / carbs, the order the split's own name is quoted in.
  String _ratio(CarbSplit split) {
    final ratio = kCarbSplitRatios[split]!;
    return '${ratio.protein} / ${ratio.fat} / ${ratio.carbs}';
  }
}
