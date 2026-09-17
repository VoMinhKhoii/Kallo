import 'package:flutter/material.dart';

import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';

/// A run of cells belonging to one person.
@immutable
class PortionRun {
  const PortionRun({required this.color, required this.parts, this.key});

  final Color color;
  final int parts;

  /// Cells are keyed by PERSON, not position, so a run growing or shrinking
  /// moves cells instead of recolouring them — which is what lets the split
  /// and whole-portion states morph into each other.
  final String? key;
}

/// The battery frame: an ink-bordered shell and its terminal nub.
///
/// Shared by the draggable meter and the recipient's read-only readout. They
/// were two independent implementations of the same picture, which is how the
/// two drifted apart on radius and cell rounding.
class BatteryFrame extends StatelessWidget {
  const BatteryFrame({
    super.key,
    required this.height,
    required this.child,
    this.borderWidth = 2,
    this.radius = KalloRadii.xl,
    this.padding = 4,
  });

  final double height;
  final Widget child;
  final double borderWidth;
  final double radius;
  final double padding;

  /// The nub scales with the shell so a 30pt readout does not wear a 56pt
  /// meter's terminal.
  double get _nubHeight => height * 0.36;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: Container(
            height: height,
            padding: EdgeInsets.all(padding),
            decoration: BoxDecoration(
              color: KalloColors.elev,
              borderRadius: BorderRadius.circular(radius),
              border: Border.all(
                color: KalloColors.text,
                width: borderWidth,
              ),
            ),
            child: child,
          ),
        ),
        Container(
          width: borderWidth > 1.5 ? 5 : 4,
          height: _nubHeight,
          margin: const EdgeInsets.only(left: 3),
          decoration: const BoxDecoration(
            color: KalloColors.text,
            borderRadius: BorderRadius.horizontal(right: Radius.circular(3)),
          ),
        ),
      ],
    );
  }
}

/// The cells inside a [BatteryFrame], one run per person.
class PortionCells extends StatelessWidget {
  const PortionCells({
    super.key,
    required this.runs,
    this.cellRadius = 6,
    this.cellGap = 1,
  });

  final List<PortionRun> runs;
  final double cellRadius;

  /// Horizontal padding EITHER SIDE of a cell, so the visible gap is twice it.
  final double cellGap;

  @override
  Widget build(BuildContext context) {
    final cells = <Widget>[];
    for (final run in runs) {
      for (var i = 0; i < run.parts; i++) {
        cells.add(
          Expanded(
            key: run.key == null ? null : ValueKey('cell-${run.key}-$i'),
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: cellGap),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: run.color,
                  borderRadius: BorderRadius.circular(cellRadius),
                ),
              ),
            ),
          ),
        );
      }
    }
    // STRETCH, not the default centre: a DecoratedBox with no child takes its
    // height from its constraints, and a centred Row hands its children a LOOSE
    // height — so every cell collapsed to zero and the frame painted empty.
    // Assertions could not see it; only a render did.
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: cells,
    );
  }
}
