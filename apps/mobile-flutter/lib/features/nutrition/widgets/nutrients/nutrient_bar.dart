/// The 3px progress bar a nutrient draws under its name.
///
/// Extracted from `nutrient_row.dart` (2026-09-07) when the micronutrient
/// grid came back and needed the same bar: one fill animation, one stagger
/// rule, whether the nutrient is drawn as a row or as a cell.
library;

import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';

/// The 3px track + fill. Fills once on arrival and then follows its value.
class NutrientBar extends StatelessWidget {
  const NutrientBar({
    super.key,
    required this.percentOfTarget,
    required this.color,
    required this.delay,
  });

  final double? percentOfTarget;
  final Color color;
  final Duration delay;

  @override
  Widget build(BuildContext context) {
    final pct = (percentOfTarget ?? 0).clamp(0, 100).toDouble();
    return ClipRRect(
      borderRadius: const BorderRadius.all(Radius.circular(2)),
      child: Container(
        height: 3,
        color: kTrack,
        child: TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: pct),
          duration: const Duration(milliseconds: 700),
          curve: Interval(
            // The stagger is spent inside one animation rather than on a
            // delayed controller per row: a card of six rows would otherwise
            // hold six timers open for the sake of 300ms of choreography.
            (delay.inMilliseconds / 1000).clamp(0.0, 0.5),
            1,
            curve: Curves.easeOutCubic,
          ),
          builder:
              (context, value, _) => FractionallySizedBox(
                alignment: Alignment.centerLeft,
                widthFactor: value / 100,
                child: ColoredBox(color: color),
              ),
        ),
      ),
    );
  }
}
