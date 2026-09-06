import 'package:flutter/material.dart';

import '../../../../theme/kallo_theme.dart';
import 'macro_split.dart';

/// The fixed columns every macro readout on the logging tab is laid out in.
///
/// Packed left-to-right with each macro sized to its own content, the columns
/// drifted with the digits — `P: 0g` and `P: 49g` are not the same width, so
/// `C:` landed at a different x on every row and a card of ingredients read as
/// ragged rather than as a table. Owning the widths HERE, rather than letting
/// each row's text decide them, is what makes the column true down the card and
/// across the card's item rows, its totals line, and the `/` picker's options.
abstract final class MacroColumns {
  /// The `P:` box. Fits the widest label (`C:` at 13.8 in Be Vietnam Pro at
  /// Caption 13) and nothing else, so the label sits tight against its own
  /// figure instead of being flung to the far side of the cell.
  ///
  /// The cluster sits on Caption (12 since the metric-compensated ramp,
  /// 2026-09-02; 13 before) rather than Meta — see [MacroSplit] for why. `C:`
  /// measures ~12.7 at 12; at the old 14 the colon clipped outright, and the
  /// column keeps that slack rather than chasing the type down.
  static const double label = 15;

  /// Sized so the block, its gutters and the kcal column leave the dish name
  /// the ~79pt its longest word needs ("Top blade", ~78 at Body 16; it was
  /// 83.0 at the old 17) — the real floor on a 390pt phone, where the row
  /// gets 334.
  ///
  /// 33 → 32 when [cellGap] grew to a structural 8 (device QA, 2026-09-01).
  /// The block gives up 3pt so the gutters can be real, which leaves the name
  /// 87 — now ~9pt over its floor. Three digits are taken in by the cell's
  /// own `FittedBox`: at Caption 12 `490g` (~32.5) renders at ~0.98, `1047g`
  /// (~35) at ~0.91.
  /// Scaling the FIGURE is the right thing to spend here; the alternative is
  /// letting it run into the next label, which is the defect this fixed.
  ///
  /// The font ignores the `tnum` feature this style asks for, so digits are
  /// genuinely variable-width: `188g` is 29.8 and `277g` is 31.6. There is no
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
  static const double value = 32;

  /// One macro's full cell.
  static const double cell = label + value;

  /// Sized for `999 kcal` at the old Value 17 (73.9) and kept there when the
  /// figure stepped to 16 (~69.5, metric-compensated ramp 2026-09-02): a
  /// three-digit total now has ~4.5pt of slack at 1.0x and is taken in by the
  /// [MacroKcal] `FittedBox` (~0.82) at the 1.3x Dynamic Type ceiling. Never
  /// clipped — that is the guarantee this column exists to make. Narrowing it
  /// to the new figure is not free: this width is what sets where the P/C/F
  /// block stops, and every point pushes the macros toward the calories.
  ///
  /// This column is SHARED with the totals line by necessity: both readouts end
  /// at the card's right edge, so its width is what sets where the P/C/F block
  /// stops. Widening it for a four-digit total pushes the macros away from the
  /// calories on every row, which is the gap that reads as a hole. A meal that
  /// clears 1000 kcal scales its total to 0.94 instead — the rarer case pays.
  static const double kcal = 74;

  /// Between the P/C/F block and the kcal column.
  ///
  /// Small because the cell before it carries its own trailing slack — the air
  /// after a short figure separates the block from the calories on its own,
  /// and an explicit gap on top of it reads as a gulf.
  static const double gap = KalloSpacing.sp1;

  /// Between one macro cell and the next — a STRUCTURAL gutter the figures
  /// cannot enter, not incidental trailing air.
  ///
  /// 2 → 8 after device QA (2026-09-01) caught the Total row rendering
  /// `C:490gF: 184g`. The old 2 leaned on each cell's leftover space to part
  /// the columns, which works at `49g` and vanishes at `490g` — the figure
  /// fills its cell exactly and the next label starts 2pt later, so the two
  /// runs touch. A day's totals reach three digits routinely, so this is the
  /// common case on that row, not an edge one.
  ///
  /// The 12pt this costs comes out of [value], not the dish-name column: the
  /// figures give way before the reading text does.
  static const double cellGap = KalloSpacing.sp2; // 8

  /// The whole P/C/F block: three cells plus the two gaps inside it.
  static const double split = cell * 3 + cellGap * 2;
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

