import 'package:flutter/material.dart';

import '../../logic/logging_spacing.dart';
import '../../../../shared/widgets/typography/kallo_text.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/logging_models.dart';
import '../../logic/format.dart';
import 'persisted_meal_chevron_toggle.dart';
import 'persisted_meal_expanded_details.dart';

class PersistedMealCardContent extends StatelessWidget {
  const PersistedMealCardContent({
    super.key,
    required this.meal,
    required this.expand,
    required this.curvedExpand,
    required this.onToggle,
    this.editorBody,
    this.borderRadius = const BorderRadius.all(
      Radius.circular(KalloRadii.containerLg),
    ),
    this.boxShadow = const [KalloShadows.sm],
  });

  final PersistedMeal meal;
  final Animation<double> expand;
  final Animation<double> curvedExpand;
  final VoidCallback onToggle;

  /// When set, the read-only body (collapsed summary + expanded details) is
  /// swapped IN PLACE for this editor — the header (quote + chevron) stays. No
  /// enter/exit animation overlaps the swap, mirroring the web's amount editor.
  final Widget? editorBody;

  /// The card's shape. Squared on the trailing side mid-swipe, so the card and
  /// the removal panel behind it meet on a straight seam — see [SwipeToRemove].
  final BorderRadius borderRadius;

  /// Dropped mid-swipe: cast onto the red panel the lift reads as grime along
  /// the seam. [SwipeToRemove] decides that, so this is handed the answer.
  final List<BoxShadow>? boxShadow;

  @override
  Widget build(BuildContext context) {
    final n = meal.nutrition;

    return Container(
      padding: LoggingSpacing.card,
      decoration: BoxDecoration(
        color: KalloColors.elev,
        borderRadius: borderRadius,
        border: Border.all(color: KalloColors.borderSoft),
        boxShadow: boxShadow,
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
                  child: KalloText(
                    meal.rawInput,
                    variant: KalloTextVariant.mealQuote,
                    style: const TextStyle(
                      fontSize: 17,
                      height: 28 / 17, // leading-7 (28px)
                    ),
                  ),
                ),
                const SizedBox(width: KalloSpacing.sp3), // gap-3
                PersistedMealChevronToggle(expand: expand, onTap: onToggle),
              ],
            ),
          ),

          // Edit mode swaps the read-only body for the amount editor in place.
          if (editorBody != null) editorBody!,

          // Collapsed summary — fades + collapses height as it expands.
          if (editorBody == null)
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
              padding: const EdgeInsets.only(top: KalloSpacing.sp2), // mt-2
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'P: ${fmtG(n.proteinG)}  C: ${fmtG(n.carbohydrateG)}  F: ${fmtG(n.fatG)}', style: dashMeta(tabular: true),),
                  Text(
                    fmtKcal(n.caloriesKcal),
                    style: dashValue(),
                  ),
                ],
              ),
            ),
          ),

          // Expanded details — animate height open (easeInOut).
          if (editorBody == null)
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
