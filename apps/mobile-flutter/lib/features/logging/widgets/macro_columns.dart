import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_theme.dart';
import '../logic/format.dart';

/// The fixed columns every macro readout on the logging tab is laid out in.
///
/// Packed left-to-right with each macro sized to its own content, the columns
/// drifted with the digits — `P: 0g` and `P: 49g` are not the same width, so
/// `C:` landed at a different x on every row and a card of ingredients read as
/// ragged rather than as a table. Owning the widths HERE, rather than letting
/// each row's text decide them, is what makes the column true down the card and
/// across the card's item rows, its totals line, and the `/` picker's options.
abstract final class MacroColumns {
  /// Fits `C: 105g` (41.1 in Be Vietnam Pro at Meta 12) — three digits, which
  /// is what a meal's totals reach. `C: 999g` at 44.9 scales down a hair rather
  /// than getting its own width; a per-item macro never goes there.
  static const double cell = 40;

  /// Sized for the LARGEST kcal any row shows: the totals line's `1794 kcal` at
  /// Value 17 measures 78.7. Sizing it for the item rows instead (64.8 at Body
  /// 14) would force the total to scale down to their size, and the total is
  /// meant to carry more weight than its parts.
  static const double kcal = 80;

  /// Between the P/C/F block and the kcal column.
  static const double gap = NhamSpacing.sp2;

  /// The whole P/C/F block: three cells plus the two gaps inside it.
  static const double split = cell * 3 + NhamSpacing.sp1 * 2;
}

/// `P: 65g  C: 0g  F: 2g` in the shared cells, each label pinned left and each
/// value pinned right, so both line up down the card.
///
/// [dashMeta] is asked for tabular figures too — same-width digits keep `1g` and
/// `65g` from shifting anything inside their own cell.
class MacroSplit extends StatelessWidget {
  const MacroSplit({
    super.key,
    required this.protein,
    required this.carbs,
    required this.fat,
  });

  final double? protein;
  final double? carbs;
  final double? fat;

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
      ],
    );
  }
}

/// The kcal column: fixed width, pinned to the row's right edge, and scaling
/// [child] down rather than clipping or ellipsizing it.
///
/// Fixed columns and a growable text scale are in direct conflict, and losing
/// the text is the worst way to resolve it: a clipped `240 kcal` renders as a
/// bare `240`, which reads as a different unit rather than as truncation, and a
/// value that ellipsizes in one row but not the next is exactly the ragged
/// column the fixed cells exist to prevent.
class MacroKcal extends StatelessWidget {
  const MacroKcal({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: MacroColumns.kcal,
      child: Align(
        alignment: Alignment.centerRight,
        child: FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerRight,
          child: child,
        ),
      ),
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
      width: MacroColumns.cell,
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
