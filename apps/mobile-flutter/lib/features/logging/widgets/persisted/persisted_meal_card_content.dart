import 'package:flutter/material.dart';

import '../../logic/logging_spacing.dart';
import '../../../../shared/logic/macro_composition.dart';
import '../../../../shared/widgets/nutrition/meal_block.dart';
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
    this.borderRadius = const BorderRadius.all(Radius.circular(KalloRadii.card)),
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

  @override
  Widget build(BuildContext context) {
    final n = meal.nutrition;
    final composition = compositionFromGrams((
      protein: n.proteinG,
      carbohydrate: n.carbohydrateG,
      fat: n.fatG,
    ));

    return Container(
      padding: LoggingSpacing.card,
      decoration: BoxDecoration(
        color: KalloColors.elev,
        borderRadius: borderRadius,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // The SHARED meal-block anatomy (native pass): meal text 14 regular
          // with the collapse chevron on its line, the 6px calorie-share bar,
          // then the P/C/F legend with the kcal total at its right. The Lora
          // quote is gone — the dashboard greeting is the app's one serif
          // moment again — and the bar and legend stay put while the card
          // opens: they are the card's identity, not a collapsed summary of
          // what is inside it.
          //
          // The whole block is the toggle target, not just the chevron.
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onToggle,
            child: MealBlock(
              title: meal.rawInput,
              titleMaxLines: 4,
              segments: composition.segments,
              gramLabels: {
                if (n.proteinG != null) 'protein': 'P ${fmtG(n.proteinG)}',
                if (n.carbohydrateG != null)
                  'carbohydrate': 'C ${fmtG(n.carbohydrateG)}',
                if (n.fatG != null) 'fat': 'F ${fmtG(n.fatG)}',
              },
              kcalLabel: fmtKcal(n.caloriesKcal),
              kcalPlacement: MealBlockKcal.legendTrailing,
              titleTrailing: PersistedMealChevronToggle(
                expand: expand,
                onTap: onToggle,
              ),
              // The breakdown opens BETWEEN the title and the bar+legend, so
              // the bar and its total always close the card. The details grow
              // in place and push the bar down with them — no jump-cut.
              middle: editorBody == null
                  ? SizeTransition(
                      sizeFactor: curvedExpand,
                      alignment: Alignment.topCenter,
                      child: FadeTransition(
                        opacity: curvedExpand,
                        child: PersistedMealExpandedDetails(meal: meal),
                      ),
                    )
                  : null,
            ),
          ),

          // Edit mode swaps the read-only body for the amount editor in place.
          if (editorBody != null) editorBody!,
        ],
      ),
    );
  }
}
