import 'package:flutter/material.dart';

import '../../../models/nutrition.dart';
import '../../../theme/nham_colors.dart';
import 'spotlight_row.dart';

/// RN port of `apps/mobile/src/components/nutrition/sections/focus-section.tsx`.
class FocusSection extends StatelessWidget {
  const FocusSection({super.key, required this.cards});

  final List<NutrientCardData> cards;

  @override
  Widget build(BuildContext context) {
    if (cards.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < cards.length; i++) ...[
          if (i > 0) const SizedBox(height: 24),
          if (i < cards.length - 1)
            Container(
              padding: const EdgeInsets.only(bottom: 24),
              decoration: const BoxDecoration(
                border: Border(
                  bottom: BorderSide(color: NhamColors.borderBiscotti40),
                ),
              ),
              child: SpotlightRow(card: cards[i], delay: 100 + i * 60),
            )
          else
            SpotlightRow(card: cards[i], delay: 100 + i * 60),
        ],
      ],
    );
  }
}
