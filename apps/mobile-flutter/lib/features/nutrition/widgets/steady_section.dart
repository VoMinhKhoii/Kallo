import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../features/dashboard/widgets/dashboard_tokens.dart';
import '../../../models/nutrition.dart';
import '../../../shared/widgets/section_eyebrow.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_typography.dart';
import 'nutrient_row.dart';

/// RN port of `apps/mobile/src/components/nutrition/sections/steady-section.tsx`.
/// The web's `sm:grid-cols-2` split collapses to a single column on phone.
class SteadySection extends StatelessWidget {
  const SteadySection({super.key, required this.cards});

  final List<NutrientCardData> cards;

  @override
  Widget build(BuildContext context) {
    if (cards.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            SectionEyebrow(
              label: tr('nutrition.steady.eyebrow'),
              delay: const Duration(milliseconds: 180),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Text(
                tr('nutrition.steady.hint'),
                textAlign: TextAlign.right,
                style: NhamTextStyles.sansRegular(fontSize: 11)
                    .copyWith(color: NhamColors.textMuted),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        ClipRRect(
          borderRadius: BorderRadius.circular(kCardRadius),
          child: DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(kCardRadius),
              color: kCardSurface,
              boxShadow: const [kCardShadow],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final card in cards) NutrientRow(card: card),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
