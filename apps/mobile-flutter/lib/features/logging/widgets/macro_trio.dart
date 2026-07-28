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

  /// Wide enough for `C: 999g` at Meta 12 — past that the value ellipsizes
  /// rather than pushing the next column out of line.
  static const double _cell = 48;

  /// `9999 kcal` at Body 14 medium.
  static const double _kcal = 62;

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
          child: Text(
            fmtKcal(calories),
            maxLines: 1,
            textAlign: TextAlign.right,
            style: dashBody(weight: FontWeight.w500, tabular: true),
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
          Text(label, style: style),
          Expanded(
            child: Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.right,
              style: style,
            ),
          ),
        ],
      ),
    );
  }
}
