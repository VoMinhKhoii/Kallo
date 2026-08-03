import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_theme.dart';
import '../logic/format.dart';

/// The `P: 65g  C: 0g  F: 2g   280 kcal` tail of a meal row, laid out as FIXED
/// columns rather than a plain [Row] of variable-width text.
///
/// Packed left-to-right, each macro sized to its content, the columns drifted
/// with the digits: `C:` landed at a different x on every row, so a card of
/// ingredients read as ragged rather than as a table. Each macro now owns a
/// fixed cell with its label pinned left and its value pinned right, so both
/// the labels and the numbers line up down the card.
///
/// [dashMeta]/[dashBody] are asked for tabular figures too — same-width digits
/// keep `1g` and `65g` from shifting anything inside their own cell.
///
/// EVERY value scales down inside its cell rather than clipping or ellipsizing.
/// Fixed columns and a growable text scale are in direct conflict, and losing
/// the text is the worst way to resolve it: a clipped `240 kcal` renders as a
/// bare `240`, which reads as a different unit rather than as truncation, and a
/// value that ellipsizes in one row but not the next is exactly the ragged
/// column the fixed cells exist to prevent.
class MacroTrio extends StatelessWidget {
  const MacroTrio({
    super.key,
    required this.protein,
    required this.carbs,
    required this.fat,
    required this.calories,
  });

  final double? protein;
  final double? carbs;
  final double? fat;
  final double? calories;

  /// Fits `C: 105g` (41.1 in Be Vietnam Pro at Meta 12) — three digits, which
  /// is what the day's totals reach. `C: 999g` at 44.9 scales down a hair
  /// rather than getting its own width; a per-item macro never goes there.
  static const double _cell = 40;

  /// Sized for the LARGEST kcal any row shows: the totals line's
  /// `1794 kcal` at Value 17 measures 78.7. Sizing it for the item rows
  /// instead (64.8 at Body 14) would force the total to scale down to their
  /// size, and the total is meant to carry more weight than its parts.
  ///
  /// Shared with [MealTotalsRow] and the `/` picker's options, so a kcal figure
  /// sits at the same x whether you are choosing a dish, reading one back, or
  /// looking at the day's total.
  static const double kcalColumn = 80;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        _Cell(label: 'P:', value: fmtG(protein)),
        const SizedBox(width: NhamSpacing.sp1),
        _Cell(label: 'C:', value: fmtG(carbs)),
        const SizedBox(width: NhamSpacing.sp1),
        _Cell(label: 'F:', value: fmtG(fat)),
        const SizedBox(width: NhamSpacing.sp2),
        SizedBox(
          width: kcalColumn,
          child: Align(
            alignment: Alignment.centerRight,
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerRight,
              child: Text(
                fmtKcal(calories),
                maxLines: 1,
                softWrap: false,
                style: dashBody(weight: FontWeight.w500, tabular: true),
              ),
            ),
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
/// which is why [MacroTrio.kcalColumn] is sized for this line and not for
/// them.
class MealTotalsRow extends StatelessWidget {
  const MealTotalsRow({
    super.key,
    required this.label,
    required this.protein,
    required this.carbs,
    required this.fat,
    required this.calories,
  });

  final String label;
  final double? protein;
  final double? carbs;
  final double? fat;
  final double? calories;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: dashBody(weight: FontWeight.w500, tabular: true),
          ),
        ),
        const SizedBox(width: NhamSpacing.sp3),
        // The SAME cells the item rows use, not an interpolated string. A
        // single `P: 67g  C: 105g  F: 16g` run sits wherever its own width puts
        // it, so the totals never lined up with the rows they sum. Sharing the
        // geometry makes the column true down the whole card.
        _Cell(label: 'P:', value: fmtG(protein)),
        const SizedBox(width: NhamSpacing.sp1),
        _Cell(label: 'C:', value: fmtG(carbs)),
        const SizedBox(width: NhamSpacing.sp1),
        _Cell(label: 'F:', value: fmtG(fat)),
        const SizedBox(width: NhamSpacing.sp2),
        SizedBox(
          width: MacroTrio.kcalColumn,
          child: Align(
            alignment: Alignment.centerRight,
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerRight,
              child: Text(
                fmtKcal(calories),
                maxLines: 1,
                softWrap: false,
                style: dashValue(),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _Cell extends StatelessWidget {
  const _Cell({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final style = dashMeta(tabular: true);
    return SizedBox(
      width: MacroTrio._cell,
      child: Row(
        children: [
          // The label scales with the value so `C:` can never crowd out the
          // number it belongs to — both shrink together, and the pair stays
          // pinned to the cell's two edges.
          Flexible(
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(label, maxLines: 1, softWrap: false, style: style),
            ),
          ),
          Expanded(
            child: Align(
              alignment: Alignment.centerRight,
              child: FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerRight,
                child: Text(value, maxLines: 1, softWrap: false, style: style),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
