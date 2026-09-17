import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/split_parts.dart';
import '../portion/portion_cells.dart';
import '../portion/portion_metrics.dart';

/// A compact, read-only battery: how much of a shared dish is yours.
///
/// Composed from the SAME [BatteryFrame] and [PortionCells] the draggable meter
/// uses, so the two readings cannot drift apart on radius, cell rounding or
/// nub. What it deliberately does not borrow is the meter's interaction
/// anatomy — 56pt shell, a pin and a kcal per person — because the recipient is
/// being shown a division, not offered one.
class PortionReadout extends StatelessWidget {
  const PortionReadout({
    super.key,
    required this.minePercent,
    required this.mineColor,
    required this.mineLabel,
    required this.restLabel,
  });

  /// 0–100. Rounded for display; the cell split rounds to the nearest part.
  final int minePercent;
  final Color mineColor;
  final String mineLabel;
  final String restLabel;

  @override
  Widget build(BuildContext context) {
    // Snap to the same 20-part grid the sender divided on, so the bar can never
    // show a boundary the control could not have produced.
    final mineParts =
        ((minePercent / 100) * kTotalParts).round().clamp(0, kTotalParts);

    return Semantics(
      label: '$restLabel, $mineLabel',
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          BatteryFrame(
            height: PortionMetrics.readoutHeight,
            borderWidth: 1.5,
            radius: KalloRadii.lg,
            padding: 3,
            child: PortionCells(
              cellRadius: 3,
              cellGap: 0.75,
              runs: [
                // The sender's share stays NEUTRAL: one invite cannot know how
                // the remainder was divided among anyone else, so colouring it
                // would claim more than we know.
                PortionRun(
                  color: KalloColors.track,
                  parts: kTotalParts - mineParts,
                ),
                PortionRun(color: mineColor, parts: mineParts),
              ],
            ),
          ),
          const SizedBox(height: KalloSpacing.sp2),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(restLabel, style: dashCaption()),
              Text(mineLabel, style: dashCaption(color: kInk)),
            ],
          ),
        ],
      ),
    );
  }
}
