import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../../../models/nutrition/ingredient.dart';
import '../../../../../../shared/logic/macro_composition.dart';
import '../../../../../../shared/widgets/gauge/macro_ring.dart';
import '../../../../../../theme/calm_tokens.dart';
import '../../../../logic/manual/manual_display.dart';

/// The meal at a glance: the macro ring with its calories, and the three
/// macros in grams beside it — the same glyphs and pigments the ring uses, so
/// each row names the colour it sits next to.
///
/// No card behind it (owner review): it is read, never tapped, and a white
/// slab made the sheet's one summary look like another list. A value the
/// totals don't know (null) reads "—", never 0.
class ManualMealTotals extends StatelessWidget {
  const ManualMealTotals({super.key, required this.totals});

  final IngredientMacrosPer100g totals;

  @override
  Widget build(BuildContext context) {
    final grams = {
      'protein': totals.proteinG,
      'carbohydrate': totals.carbohydrateG,
      'fat': totals.fatG,
    };
    final labels = {
      'protein': 'logging.barcode.protein'.tr(),
      'carbohydrate': 'logging.barcode.carbs'.tr(),
      'fat': 'logging.barcode.fat'.tr(),
    };
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 4, 4, 0),
      child: Row(
        children: [
          MacroRing(
            kcal: totals.caloriesKcal,
            protein: totals.proteinG,
            carbs: totals.carbohydrateG,
            fat: totals.fatG,
          ),
          const SizedBox(width: 24),
          Expanded(
            child: Column(
              children: [
                for (final (i, key) in kCompositionKeys.indexed) ...[
                  if (i > 0) const Divider(height: 1, color: kHairline),
                  SizedBox(
                    height: 40,
                    child: Row(
                      children: [
                        Icon(
                          kMacroIcons[key],
                          size: 14,
                          color: kCompositionColors[key],
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            labels[key]!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: dashMeta(),
                          ),
                        ),
                        Text(
                          '${formatMacroGrams(grams[key])} g',
                          style: dashValue(),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
