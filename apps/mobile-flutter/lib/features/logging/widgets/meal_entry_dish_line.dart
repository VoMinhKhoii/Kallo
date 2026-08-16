import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../models/meal.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';
import '../logic/logging_spacing.dart';
import '../logic/meal_utils.dart';
import 'macro_trio.dart';
import 'meal_stepper_button.dart';

/// The dish line itself: name + macros, with the +/- steppers replacing the
/// macro split in edit mode. Sibling of the portion assumption line, which
/// [MealEntryItemRow] stacks underneath it.
class MealEntryDishLine extends StatelessWidget {
  const MealEntryDishLine({
    super.key,
    required this.item,
    required this.editing,
    required this.onChange,
  });

  final MealItem item;
  final bool editing;
  final void Function(String itemId, double delta) onChange;

  @override
  Widget build(BuildContext context) {
    final isGrams = item.unit == 'g' || item.unit == 'ml';
    final step = isGrams ? 10.0 : 1.0;
    final minusDisabled =
        isGrams ? item.quantity <= minDishGrams : item.quantity <= 0;
    // Stepping a count-unit item to 0 strikes the row — a clear "this one's
    // out" cue before confirm drops it. Grams floor at minDishGrams, so only
    // count units can reach 0.
    final struck = !isGrams && item.quantity <= 0;

    // No wash, no inset. The row's geometry is IDENTICAL in both modes — only
    // the middle block's contents change — so tapping Edit doesn't shuffle the
    // card. What tells you the card is editable is the card itself: its border
    // goes to the accent the app already uses for a focused input.
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: LoggingSpacing.row),
      child: Row(
        children: [
          // TWO lines, and the SAME column whether or not you are editing. The
          // macro tail is fixed-width, so the name gets ~104pt on a phone — on
          // one line "Sữa chua uống berries" ellipsised to "Sữa chua uống ber…",
          // losing the part that identifies it.
          Expanded(
            child: Text(
              item.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: dashBody().merge(
                struck
                    ? const TextStyle(
                        decoration: TextDecoration.lineThrough,
                        decorationColor: kInkMuted,
                        color: kInkMuted,
                      )
                    : null,
              ),
            ),
          ),
          const SizedBox(width: KalloSpacing.sp3), // gap-3
          // The SHARED trio, not a hand-rolled Row. Content-sized cells put
          // `C:` at a different x on every row — `P: 0g` and `P: 49g` are not
          // the same width — so a card of items read as ragged. MacroTrio pins
          // each macro to a fixed cell and scales the value down inside it
          // rather than clipping.
          //
          // Editing swaps the P/C/F block for the steppers IN PLACE. They are
          // the control for the number the row is about, and they sit in the
          // middle rather than in front of the name so nothing else moves.
          Opacity(
            opacity: struck ? 0.4 : 1,
            child: MacroTrio(
              protein: item.macros.protein,
              carbs: item.macros.carbs,
              fat: item.macros.fat,
              calories: item.macros.calories,
              splitReplacement: editing
                  ? _QuantityStepper(
                      quantity: item.quantity,
                      minusDisabled: minusDisabled,
                      onChange: (delta) => onChange(item.id, delta),
                      step: step,
                    )
                  : null,
            ),
          ),
        ],
      ),
    );
  }
}

/// `−  180  +` for one row, centred in the slot the P/C/F block vacates.
///
/// Centred rather than packed left because the block it replaces is wider than
/// it is (140 against 104): pinning it to either edge would leave a lopsided
/// gap that reads as a layout bug rather than as a control.
class _QuantityStepper extends StatelessWidget {
  const _QuantityStepper({
    required this.quantity,
    required this.minusDisabled,
    required this.onChange,
    required this.step,
  });

  final double quantity;
  final bool minusDisabled;
  final ValueChanged<double> onChange;
  final double step;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        MealStepperButton(
          icon: LucideIcons.minus300, // lucide Minus
          disabled: minusDisabled,
          onTap: minusDisabled ? null : () => onChange(-step),
        ),
        const SizedBox(width: 2), // gap-0.5
        SizedBox(
          width: 28,
          // Scale down rather than clip. Grams reach four digits on a large
          // bowl, and a clipped gram figure reads as a plausible wrong number —
          // the same reason MacroTrio fits its values instead of truncating.
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              quantity.round().toString(),
              textAlign: TextAlign.center,
              style: dashMeta(color: kInk, tabular: true),
            ),
          ),
        ),
        const SizedBox(width: 2),
        MealStepperButton(
          icon: LucideIcons.plus300, // lucide Plus
          onTap: () => onChange(step),
        ),
      ],
    );
  }
}
