import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/split_parts.dart';

/// A compact, read-only battery: how much of a shared dish is yours.
///
/// Deliberately NOT `PortionBattery` with `interactive: false`. That control is
/// built to be dragged — 56pt tall, a pin per person, a kcal readout above each
/// — and the recipient is being shown a division, not offered one. Squeezing it
/// into a card would be reuse for its own sake. What the two DO share is the
/// cell grid and the seat colours, so the two readings look like the same
/// object family.
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
    final restParts = kTotalParts - mineParts;

    return Semantics(
      label: '$restLabel, $mineLabel',
      excludeSemantics: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Container(
                  height: 30,
                  padding: const EdgeInsets.all(3),
                  decoration: BoxDecoration(
                    color: KalloColors.elev,
                    borderRadius: BorderRadius.circular(KalloRadii.lg),
                    border: Border.all(color: KalloColors.text, width: 1.5),
                  ),
                  child: Row(
                    children: [
                      // The sender's share stays NEUTRAL: one invite cannot
                      // know how the remainder was divided among anyone else,
                      // so colouring it would claim more than we know.
                      for (var i = 0; i < restParts; i++)
                        const _Cell(color: KalloColors.track),
                      for (var i = 0; i < mineParts; i++)
                        _Cell(color: mineColor),
                    ],
                  ),
                ),
              ),
              Container(
                width: 4,
                height: 13,
                margin: const EdgeInsets.only(left: 2),
                decoration: const BoxDecoration(
                  color: KalloColors.text,
                  borderRadius:
                      BorderRadius.horizontal(right: Radius.circular(2)),
                ),
              ),
            ],
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

class _Cell extends StatelessWidget {
  const _Cell({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 0.75),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(3),
          ),
        ),
      ),
    );
  }
}
