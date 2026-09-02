import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../../models/nutrition/ingredient.dart';
import '../../../../../shared/logic/macro_composition.dart';
import '../../../../../shared/widgets/nutrition/composition_bar.dart';
import '../../../../../theme/calm_tokens.dart';

/// The running total above the added-items card, in the shared meal-block
/// anatomy (native pass, 2026-08-31): an "Added" group label, the 6px
/// calorie-share bar, then a legend row — P/C/F glyphs + grams on the left,
/// the kcal total 14/500 ink at the bar's bottom-right.
///
/// It is not a [MealBlock] because there is no meal TEXT here: the block's
/// title slot would have to carry a label, which is a different type role
/// (14/500 muted, not 14/400 ink). Bar, glyphs and pigments are the same
/// primitives, so the two read as one family.
class ManualAddedSummary extends StatelessWidget {
  const ManualAddedSummary({super.key, required this.totals});

  final IngredientMacrosPer100g totals;

  static String _grams(double? value) =>
      value == null ? '—' : '${value.round()}g';

  @override
  Widget build(BuildContext context) {
    final composition = compositionFromGrams((
      protein: totals.proteinG,
      carbohydrate: totals.carbohydrateG,
      fat: totals.fatG,
    ));
    final labels = <String, String>{
      'protein': 'P ${_grams(totals.proteinG)}',
      'carbohydrate': 'C ${_grams(totals.carbohydrateG)}',
      'fat': 'F ${_grams(totals.fatG)}',
    };
    final kcal = totals.caloriesKcal;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('logging.manualLogging.added'.tr(), style: kGroupLabel()),
        const SizedBox(height: 6),
        CompositionBar.compact(segments: composition.segments),
        const SizedBox(height: 6),
        // Same legend spacing rule as [MealBlock]: the entries are distributed
        // across the row so each sits in equal space, rather than the macros
        // clustering at the left with kcal pushed out to the right.
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
for (final key in kCompositionKeys)
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    kMacroIcons[key],
                    size: 14,
                    color: kCompositionColors[key],
                  ),
                  const SizedBox(width: 4),
                  // Caption, not Meta — same one-line macro legend as
                  // [MealBlock]; on a 320pt phone Meta needed ~288pt of a
                  // 288pt row, and the totals row has no slack at 1.3x.
                  Text(labels[key]!, style: dashCaption()),
                ],
              ),
            Text(
              kcal == null
                  ? '—'
                  : '${kcal.round()} ${'logging.manualLogging.kcal'.tr()}',
              style: dashBody(weight: FontWeight.w500, tabular: true),
            ),
          ],
        ),
      ],
    );
  }
}
