import 'package:flutter/material.dart';

import '../../../../models/social/circle.dart';
import '../../../../shared/logic/macro_composition.dart';
import '../../../../shared/widgets/nutrition/composition_bar.dart';
import '../../../../shared/widgets/nutrition/macro_scale.dart';
import '../../../../theme/calm_tokens.dart';
import 'feed_rhythm.dart';

class FeedNutrition extends StatelessWidget {
  const FeedNutrition({required this.meal, super.key});

  final CircleFeedMeal meal;

  @override
  Widget build(BuildContext context) {
    final composition = compositionFromGrams(
      protein: meal.proteinG,
      carbohydrate: meal.carbohydrateG,
      fat: meal.fatG,
    );
    final kcal = meal.caloriesKcal;
    // Nothing measured at all — draw nothing rather than a row of dashes over
    // an empty bar.
    if (kcal == null && composition.totalKcal <= 0) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text.rich(
          TextSpan(
            // Unit stays at Meta so the figure carries the mass, not the word.
            style: dashMeta(),
            children: [
              TextSpan(
                text: kcal == null ? '—' : '${kcal.round()}',
                // Body, not Value: at 17 the figure outweighed the meal name
                // above it, which put the post's focus back on the number this
                // redesign had just taken it off. Medium weight and ink still
                // mark it as the figure.
                style: dashBody(weight: FontWeight.w500, tabular: true),
              ),
              const TextSpan(text: ' kcal'),
            ],
          ),
        ),
        if (composition.totalKcal > 0) ...[
          const SizedBox(height: kFeedTight),
          CompositionBar(
            segments: composition.segments,
            height: kFeedBarHeight,
            gap: kFeedBarGap,
            opacity: kFeedBarOpacity,
          ),
          const SizedBox(height: kFeedTight),
        ],
        MacroScale(
          protein: meal.proteinG,
          carbohydrate: meal.carbohydrateG,
          fat: meal.fatG,
        ),
      ],
    );
  }
}
