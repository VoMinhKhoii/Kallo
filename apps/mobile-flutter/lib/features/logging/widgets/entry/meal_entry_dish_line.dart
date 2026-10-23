import 'package:flutter/material.dart';

import '../../../../models/logging/meal.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/logging_spacing.dart';
import '../macros/macro_trio.dart';

/// The dish line itself: name + macros. Sibling of the portion assumption
/// line, which [MealEntryItemRow] stacks underneath it.
class MealEntryDishLine extends StatelessWidget {
  const MealEntryDishLine({super.key, required this.item});

  final MealItem item;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: LoggingSpacing.row),
      child: Row(
        children: [
          // TWO lines. The macro tail is fixed-width, so the name gets ~104pt
          // on a phone — on one line "Sữa chua uống berries" ellipsised to
          // "Sữa chua uống ber…", losing the part that identifies it.
          Expanded(
            child: Text(
              item.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: dashBody(),
            ),
          ),
          const SizedBox(width: KalloSpacing.sp3), // gap-3
          // The SHARED trio, not a hand-rolled Row. Content-sized cells put
          // `C:` at a different x on every row — `P: 0g` and `P: 49g` are not
          // the same width — so a card of items read as ragged. MacroTrio pins
          // each macro to a fixed cell and scales the value down inside it
          // rather than clipping.
          MacroTrio(
            protein: item.macros.protein,
            carbs: item.macros.carbs,
            fat: item.macros.fat,
            calories: item.macros.calories,
          ),
        ],
      ),
    );
  }
}
