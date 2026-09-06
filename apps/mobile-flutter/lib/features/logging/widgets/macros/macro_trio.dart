import 'package:flutter/material.dart';

import '../../../../shared/logic/display_format.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/format.dart';
import 'count_up.dart';
import 'macro_columns.dart';
import 'macro_split.dart';

/// The `P: 65g  C: 0g  F: 2g   280 kcal` tail of a meal row, laid out in the
/// shared [MacroColumns] rather than as a plain [Row] of variable-width text.
class MacroTrio extends StatelessWidget {
  const MacroTrio({
    super.key,
    required this.protein,
    required this.carbs,
    required this.fat,
    required this.calories,
    this.splitReplacement,
  });

  final double? protein;
  final double? carbs;
  final double? fat;
  final double? calories;

  /// Put in the P/C/F block's slot instead of the split, at exactly the same
  /// width — so the dish name beside it and the kcal after it do not move.
  ///
  /// For the meal card's EDIT mode, which borrows the slot for its `−/+`
  /// steppers. Putting those controls in FRONT of the name instead pushed every
  /// name 112pt to the right, and on a phone there was nothing left to push
  /// into: names collapsed to zero width and the row overflowed anyway.
  /// Swapping only the middle block keeps the row still — the numbers change
  /// under your thumb and nothing else does.
  final Widget? splitReplacement;

  /// Shared with the `/` picker's options, so a kcal figure sits at the same x
  /// whether you are choosing a dish, reading one back, or looking at a total.
  static const double kcalColumn = MacroColumns.kcal;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: MacroColumns.split,
          child:
              splitReplacement ??
              MacroSplit(protein: protein, carbs: carbs, fat: fat),
        ),
        const SizedBox(width: MacroColumns.gap),
        MacroKcal(
          child: Text(
            fmtKcal(calories, locale: localeOf(context)),
            maxLines: 1,
            softWrap: false,
            style: dashBody(tabular: true),
          ),
        ),
      ],
    );
  }
}

/// The card's bottom line: a label on the left, then the summed macros and kcal
/// in the SAME columns [MacroTrio] uses.
///
/// Shares the geometry rather than interpolating one `P: 67g  C: 105g  F: 16g`
/// run, because a single run sits wherever its own width puts it — so the
/// totals never lined up with the item rows they sum. Its kcal keeps Value 17
/// against the rows' Body 14: the total should read heavier than its parts,
/// which is why [MacroColumns.kcal] is sized for this line and not for them.
class MealTotalsRow extends StatelessWidget {
  const MealTotalsRow({
    super.key,
    required this.label,
    required this.protein,
    required this.carbs,
    required this.fat,
    required this.calories,
    this.countUp = false,
  });

  final String label;
  final double? protein;
  final double? carbs;
  final double? fat;
  final double? calories;

  /// Count the total up from zero on first build — the streaming reveal's
  /// settling beat. Ignored when the platform asks for reduced motion.
  final bool countUp;

  @override
  Widget build(BuildContext context) {
    final kcal = calories;
    final locale = localeOf(context);
    final animate =
        countUp && kcal != null && !MediaQuery.disableAnimationsOf(context);
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: dashBody(tabular: true),
          ),
        ),
        const SizedBox(width: KalloSpacing.sp3),
        MacroSplit(protein: protein, carbs: carbs, fat: fat),
        const SizedBox(width: MacroColumns.gap),
        MacroKcal(
          child:
              animate
                  ? CountUpText(
                    value: kcal,
                    format: (value) => fmtKcal(value, locale: locale),
                    style: dashValue(),
                  )
                  : Text(
                    fmtKcal(kcal, locale: locale),
                    maxLines: 1,
                    softWrap: false,
                    style: dashValue(),
                  ),
        ),
      ],
    );
  }
}
