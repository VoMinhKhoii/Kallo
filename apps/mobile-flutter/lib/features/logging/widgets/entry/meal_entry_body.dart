import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/logging/meal.dart';
import '../../../../theme/kallo_colors.dart';
import '../../logic/logging_spacing.dart';
import '../macros/macro_trio.dart';
import 'meal_entry_header.dart';
import 'meal_entry_item_row.dart';

/// The unconfirmed card's contents: the quote, the dish rows, and the totals
/// line, separated by the card's two hairlines.
///
/// Split out of [MealEntry] so that widget keeps only the quantity draft and
/// the sheet that edits it, and this stays purely presentational.
class MealEntryBody extends StatelessWidget {
  const MealEntryBody({
    super.key,
    required this.rawInput,
    required this.items,
    required this.totals,
    required this.revealing,
    required this.animateIn,
    required this.countUp,
    required this.onOpen,
  });

  final String rawInput;
  final List<MealItem> items;
  final MacroBreakdown totals;
  final bool revealing;

  /// See [MealEntryItemRow.animateIn].
  final bool animateIn;

  /// Only the reveal's opening frame counts the totals up from zero.
  final bool countUp;

  /// Opens the edit sheet on [item]; [size] drops its Size row open.
  final void Function(MealItem item, {bool size}) onOpen;

  static Divider get _hairline =>
      Divider(height: 1, thickness: 1, color: KalloColors.borderFaint);

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        MealEntryHeader(rawInput: rawInput),
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
                  revealing: revealing,
                  animateIn: animateIn,
                  onOpen: () => onOpen(item),
                  onOpenSize: () => onOpen(item, size: true),
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
