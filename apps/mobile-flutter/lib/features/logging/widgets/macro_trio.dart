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

  /// Fits the widest realistic cell — `C: 999g` measures 44.9 in Be Vietnam Pro
  /// at Meta 12 — with the remainder scaling down past that.
  static const double _cell = 48;

  /// Fits `1234 kcal` (66.1 measured at Body 14 medium). The previous 62 was
  /// documented as holding `9999 kcal`; that string is really 70.5, and even
  /// `240 kcal` at 60.4 cleared 62 by 1.6pt — so any text scale above ~1.03
  /// clipped the unit off three-digit rows while leaving their neighbours
  /// intact. Four-digit dish rows scale down; four digits belong to the totals
  /// line, which is not this widget.
  static const double _kcal = 66;

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
        const SizedBox(width: NhamSpacing.sp3),
        SizedBox(
          width: _kcal,
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

/// The card's bottom line: a label on the left, the day-style macro string and
/// the kcal total on the right.
///
/// Not a [MacroTrio] — the totals read as one summed string (`P: 67g  C: 59g
/// F: 32g`) rather than as three columns, because there is no row below it to
/// line up with. It carries the same no-clipping rule though: both halves are
/// unbounded text inside a fixed-width row, so at a large text scale the kcal
/// figure had nowhere to go.
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
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Flexible(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: dashBody(weight: FontWeight.w500, tabular: true),
          ),
        ),
        const SizedBox(width: NhamSpacing.sp3),
        // The numbers are the point of the line — they take the width they
        // need and scale down together rather than either half being cut.
        Flexible(
          child: FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerRight,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'P: ${fmtG(protein)}  C: ${fmtG(carbs)}  F: ${fmtG(fat)}',
                  maxLines: 1,
                  softWrap: false,
                  style: dashMeta(tabular: true),
                ),
                const SizedBox(width: NhamSpacing.sp4),
                Text(
                  fmtKcal(calories),
                  maxLines: 1,
                  softWrap: false,
                  style: dashValue(),
                ),
              ],
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
