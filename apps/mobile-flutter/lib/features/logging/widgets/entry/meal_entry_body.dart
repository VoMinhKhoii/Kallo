import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/logging/meal.dart';
import '../../../../theme/kallo_colors.dart';
import '../../logic/logging_spacing.dart';
import '../macros/macro_trio.dart';
import 'meal_entry_header.dart';
import 'meal_entry_item_row.dart';

/// The unconfirmed card's contents: quote + Edit pill, the dish rows, and the
/// totals line, separated by the card's two hairlines.
///
/// Split out of [MealEntry] so that widget keeps only the quantity-edit state
/// machine (steppers, portion picker, confirm cooldown) and this stays purely
/// presentational.
class MealEntryBody extends StatelessWidget {
  const MealEntryBody({
    super.key,
    required this.rawInput,
    required this.items,
    required this.totals,
    required this.editing,
    required this.revealing,
    required this.animateIn,
    required this.countUp,
    required this.onToggleEditing,
    required this.onChange,
    required this.onAdjustPortion,
  });

  final String rawInput;
  final List<MealItem> items;
  final MacroBreakdown totals;
  final bool editing;
  final bool revealing;

  /// See [MealEntryItemRow.animateIn].
  final bool animateIn;

  /// Only the reveal's opening frame counts the totals up from zero.
  final bool countUp;

  final VoidCallback onToggleEditing;
  final void Function(String itemId, double delta) onChange;
  final ValueChanged<MealItem> onAdjustPortion;

  static const Divider _hairline = Divider(
    height: 1,
    thickness: 1,
    color: KalloColors.borderFaint,
  );

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        MealEntryHeader(
          rawInput: rawInput,
          editing: editing,
          onToggleEditing: onToggleEditing,
        ),
        const SizedBox(height: LoggingSpacing.section),
        _hairline,
        const SizedBox(height: LoggingSpacing.section),
        Padding(
          padding: const EdgeInsets.only(bottom: LoggingSpacing.section),
          child: Column(
            children: [
              // The stagger lives inside the row — see MealEntryItemRow.
              for (final (index, item) in items.indexed)
                MealEntryItemRow(
                  key: ValueKey(item.id),
                  item: item,
                  index: index,
                  editing: editing,
                  revealing: revealing,
                  animateIn: animateIn,
                  onChange: onChange,
                  onAdjustPortion: onAdjustPortion,
                ),
            ],
          ),
        ),
        _hairline,
        const SizedBox(height: LoggingSpacing.section),
        // The SHARED totals row, not an interpolated `P: … C: … F: …` run. A
        // single run sits wherever its own width puts it, so this line never
        // lined up with the item rows it sums.
        MealTotalsRow(
          label: 'logging.mealEntry.total'.tr(),
          protein: totals.protein,
          carbs: totals.carbs,
          fat: totals.fat,
          calories: totals.calories,
          countUp: countUp,
        ),
      ],
    );
  }
}
