import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';

/// The fixed columns every macro readout on the logging tab is laid out in.
///
/// Packed left-to-right with each macro sized to its own content, the columns
/// drifted with the digits — `P: 0g` and `P: 49g` are not the same width, so
/// `C:` landed at a different x on every row and a card of ingredients read as
/// ragged rather than as a table. Owning the widths HERE, rather than letting
/// each row's text decide them, is what makes the column true down the card and
/// across the card's item rows, its totals line, and the `/` picker's options.
abstract final class MacroColumns {
  /// The `P:` box. Fits the widest label (`C:` at 12.7 in Be Vietnam Pro at
  /// Meta 12) and nothing else, so the label sits tight against its own figure
  /// instead of being flung to the far side of the cell.
  static const double label = 14;

  /// Sized for the widest figure a meal actually reaches — `277g` at 29.2 —
  /// not for the widest one arithmetic allows (`999g` at 32.2, which scales to
  /// 0.94 and does not occur in a meal). The difference is 3pt of dead air per
  /// cell, times three cells, in a row that has none to spare.
  ///
  /// The font ignores the `tnum` feature this style asks for, so digits are
  /// genuinely variable-width: `188g` is 27.6 and `277g` is 29.2. There is no
  /// single "three digits" width to size to, which is the other reason the
  /// figures are pinned left rather than right — a right-aligned column of
  /// non-tabular digits is ragged on both edges.
  ///
  /// The value starts at the field's LEFT edge, right after the label. That is
  /// what puts every figure in a column — and it leaves the `g` to float,
  /// which is the right thing to let go of: `g` is the same on every row and
  /// carries no information, while the digit it follows is what you read down
  /// the card.
  ///
  /// Right-aligning the digits instead (so they end on a shared edge) aligns
  /// the same numbers just as well, but it strands each label 17pt from its own
  /// one-digit figure — `P:` and `0g` at opposite ends of the cell with a hole
  /// between them.
  static const double value = 30;

  /// One macro's full cell.
  static const double cell = label + value;

  /// Sized for `999 kcal` at Value 17 (72.9) — every three-digit total at full
  /// size, and every item row's Body 14 figure with room to spare.
  ///
  /// This column is SHARED with the totals line by necessity: both readouts end
  /// at the card's right edge, so its width is what sets where the P/C/F block
  /// stops. Widening it for a four-digit total pushes the macros away from the
  /// calories on every row, which is the gap that reads as a hole. A meal that
  /// clears 1000 kcal scales its total to 0.94 instead — the rarer case pays.
  static const double kcal = 74;

  /// Between the P/C/F block and the kcal column, and between one macro cell
  /// and the next. Both are small because each cell already carries its own
  /// trailing slack — the air after a short figure separates the macros on its
  /// own, and an explicit gap on top of it reads as a gulf.
  static const double gap = KalloSpacing.sp1;
  static const double cellGap = KalloSpacing.sp0_5;

  /// The whole P/C/F block: three cells plus the two gaps inside it.
  static const double split = cell * 3 + cellGap * 2;
}

/// `P: 65g  C: 0g  F: 2g` in the shared cells: labels at one fixed x, figures
/// at another a label-width over.
///
/// [dashMeta] still asks for tabular figures. Be Vietnam Pro ignores `tnum`, so
/// it buys nothing here — but the request costs nothing and holds if the family
/// ever ships the feature.
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
        _Cell(label: 'P:', grams: protein),
        const SizedBox(width: MacroColumns.cellGap),
        _Cell(label: 'C:', grams: carbs),
        const SizedBox(width: MacroColumns.cellGap),
        _Cell(label: 'F:', grams: fat),
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

/// `P:` in a box of its own, then `49g` starting at that box's edge.
///
/// Both runs are pinned LEFT, so the labels form a column and the figures form
/// a column one label-width over — with only the slack inside the label box
/// (1.3pt at `C:`, 2.8pt at `P:`) between a label and its own number. The unit
/// rides along with the digit it belongs to and lands wherever that leaves it;
/// the trailing air stays inside the cell, so the next macro still starts at a
/// fixed x.
class _Cell extends StatelessWidget {
  const _Cell({required this.label, required this.grams});

  final String label;
  final double? grams;

  @override
  Widget build(BuildContext context) {
    final style = dashMeta(tabular: true);
    final value = grams == null ? 'N/A' : '${grams!.round()}g';

    Widget fit(String text) => Align(
      alignment: Alignment.centerLeft,
      child: FittedBox(
        fit: BoxFit.scaleDown,
        alignment: Alignment.centerLeft,
        child: Text(text, maxLines: 1, softWrap: false, style: style),
      ),
    );

    return SizedBox(
      width: MacroColumns.cell,
      child: Row(
        children: [
          SizedBox(width: MacroColumns.label, child: fit(label)),
          Expanded(child: fit(value)),
        ],
      ),
    );
  }
}
