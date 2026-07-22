import 'package:flutter/material.dart';

import '../../../shared/widgets/nham_text.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../data/logging_models.dart';
import '../logic/format.dart';
import 'persisted_meal_chevron_toggle.dart';
import 'persisted_meal_expanded_details.dart';

class PersistedMealCardContent extends StatelessWidget {
  const PersistedMealCardContent({
    super.key,
    required this.meal,
    required this.expand,
    required this.curvedExpand,
    required this.onToggle,
  });

  final PersistedMeal meal;
  final Animation<double> expand;
  final Animation<double> curvedExpand;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final n = meal.nutrition;

    return Container(
      padding: const EdgeInsets.all(NhamSpacing.sp4),
      decoration: BoxDecoration(
        color: NhamColors.elev,
        borderRadius: BorderRadius.circular(NhamRadii.containerLg),
        border: Border.all(color: NhamColors.borderSoft),
        boxShadow: const [NhamShadows.sm],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header — the whole row is the toggle target (not just the
          // ~24px chevron), so the comfortable tap area spans the quote.
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onToggle,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: NhamText(
                    meal.rawInput,
                    variant: NhamTextVariant.mealQuote,
                    style: const TextStyle(
                      fontSize: 17,
                      height: 28 / 17, // leading-7 (28px)
                    ),
                  ),
                ),
                const SizedBox(width: NhamSpacing.sp3), // gap-3
                PersistedMealChevronToggle(expand: expand, onTap: onToggle),
              ],
            ),
          ),

          // Collapsed summary — fades + collapses height as it expands.
          AnimatedBuilder(
            animation: curvedExpand,
            builder: (context, child) {
              final t = curvedExpand.value;
              // Summary cross-fade runs at 150ms (faster than the
              // 200ms height) — fade out within the first 0.75 of the
              // open progress.
              final fade = (1 - (t / 0.75)).clamp(0.0, 1.0);
              return ClipRect(
                child: Align(
                  heightFactor: (1 - t),
                  child: Opacity(opacity: fade, child: child),
                ),
              );
            },
            child: Padding(
              padding: const EdgeInsets.only(top: NhamSpacing.sp2), // mt-2
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  NhamText(
                    'P: ${fmtG(n.proteinG)}  C: ${fmtG(n.carbohydrateG)}  F: ${fmtG(n.fatG)}',
                    variant: NhamTextVariant.captionTabular,
                  ),
                  NhamText(
                    fmtKcal(n.caloriesKcal),
                    variant: NhamTextVariant.numStrong,
                    style: dashValue(),
                  ),
                ],
              ),
            ),
          ),

          // Expanded details — animate height open (easeInOut).
          SizeTransition(
            sizeFactor: curvedExpand,
            alignment: Alignment.topCenter,
            child: FadeTransition(
              opacity: curvedExpand,
              child: PersistedMealExpandedDetails(meal: meal),
            ),
          ),
        ],
      ),
    );
  }
}
