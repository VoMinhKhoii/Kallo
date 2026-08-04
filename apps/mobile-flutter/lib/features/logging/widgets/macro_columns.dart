import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_theme.dart';

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

  /// The figures, RIGHT-aligned in a box of their own: three tabular digits
  /// measure 24.5, so `5`, `49` and `105` all end on the same x and the column
  /// reads as a column.
  ///
  /// This is what the cell aligns on — not the `g`. Aligning whole strings
  /// (`5g`, `49g`) lines up the unit and lets the digits fall wherever their
  /// count puts them, which is the wrong thing to hold still: the number is
  /// what you read down the card.
  static const double digits = 25;

  /// The `g`, immediately after the figures.
  static const double unit = 8;

  /// One macro's full cell.
  ///
  /// It used to pin the label to the left edge and the value to the right,
  /// which put a gap between them that changed size with the number of digits —
  /// `P: 0g` yawned open while `P:49g` closed up, on adjacent rows of the same
  /// card.
  static const double cell = label + digits + unit;

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

/// `P: 65g  C: 0g  F: 2g` in the shared cells: labels at a fixed x, figures
/// right-aligned in a field of their own, `g` after them.
///
/// [dashMeta] is asked for tabular figures too — same-width digits are what let
/// a right-aligned field line `5`, `49` and `105` up on the same edge.
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
        const SizedBox(width: NhamSpacing.sp1),
        _Cell(label: 'C:', grams: carbs),
        const SizedBox(width: NhamSpacing.sp1),
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

/// `P:` then the figure then `g`, in three boxes: the label's own width, a
/// right-aligned digit field, and the unit.
///
/// Three boxes rather than two because the alignment the eye wants is on the
/// DIGITS. A single right-aligned `49g` run lines the unit up and lets the
/// figures land wherever their digit count puts them; a single left-aligned one
/// does the reverse. Splitting the unit off holds the figures still and lets
/// `g` follow them.
class _Cell extends StatelessWidget {
  const _Cell({required this.label, required this.grams});

  final String label;
  final double? grams;

  @override
  Widget build(BuildContext context) {
    final style = dashMeta(tabular: true);
    final known = grams != null;
    // An unknown macro has no figure to align — it takes the digit field whole
    // and drops the unit, rather than rendering a bare `g` after nothing.
    final figure = known ? '${grams!.round()}' : 'N/A';

    Widget fit(String text, Alignment align) => FittedBox(
      fit: BoxFit.scaleDown,
      alignment: align,
      child: Text(text, maxLines: 1, softWrap: false, style: style),
    );

    return SizedBox(
      width: MacroColumns.cell,
      child: Row(
        children: [
          SizedBox(
            width: MacroColumns.label,
            child: Align(
              alignment: Alignment.centerLeft,
              child: fit(label, Alignment.centerLeft),
            ),
          ),
          Expanded(
            child: Align(
              alignment: Alignment.centerRight,
              child: fit(figure, Alignment.centerRight),
            ),
          ),
          SizedBox(
            width: MacroColumns.unit,
            child:
                known
                    ? Align(
                      alignment: Alignment.centerLeft,
                      child: fit('g', Alignment.centerLeft),
                    )
                    : null,
          ),
        ],
      ),
    );
  }
}
