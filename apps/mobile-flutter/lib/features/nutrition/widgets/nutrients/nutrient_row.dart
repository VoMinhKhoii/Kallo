import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';

/// One data row inside a nutrition [GroupedListCard] — the Settings row
/// anatomy, in its display-only form (native pass, 2026-08-31): an optional
/// leading 24pt glyph, the nutrient's name 14/500 ink, its figure 12 muted on
/// the SAME line at the right, and a 3px bar under both.
///
/// **No percentage.** The figure and the bar already say how the day went, and
/// a third reading of the same fact ("78.5 / 70 mg", a full bar AND "112%") is
/// what made the old two-column grid read like a spreadsheet.
///
/// The bar is 3px, not the 4px + end-tick of `TargetProgressBar`: at this size
/// the tick reads as a speck of dirt on the row rather than as the 100% mark,
/// and the row's own figure carries the target.
class NutrientRow extends StatelessWidget {
  const NutrientRow({
    super.key,
    required this.label,
    required this.value,
    required this.percentOfTarget,
    required this.fillColor,
    this.icon,
    this.iconColor,
    this.barDelay = Duration.zero,
  });

  final String label;

  /// The figure as it reads on the row — "125 / 138 g avg", "78.5 / 70 mg".
  final String value;

  /// 0..100+, or null when the nutrient has no target (the bar stays empty).
  final double? percentOfTarget;

  /// The fill: the macro's own colour on a macro row, the status colour on a
  /// nutrient row.
  final Color fillColor;

  final IconData? icon;
  final Color? iconColor;

  /// Staggers the fill so a card of rows arrives in sequence.
  final Duration barDelay;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '$label, $value',
      excludeSemantics: true,
      child: ConstrainedBox(
        // 56 single-line, the app-wide grouped-row minimum.
        constraints: const BoxConstraints(minHeight: 56),
        child: Row(
          children: [
            if (icon != null) ...[
              SizedBox(
                width: KalloIcons.size,
                child: Center(
                  child: Icon(icon, size: KalloIcons.size, color: iconColor),
                ),
              ),
              const SizedBox(width: KalloSpacing.sp3),
            ],
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Expanded(
                        child: Text(
                          label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: dashBody(weight: FontWeight.w500),
                        ),
                      ),
                      const SizedBox(width: KalloSpacing.sp2),
                      Text(value, style: dashMeta(tabular: true)),
                    ],
                  ),
                  const SizedBox(height: KalloSpacing.sp1_5),
                  _Bar(
                    percentOfTarget: percentOfTarget,
                    color: fillColor,
                    delay: barDelay,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The 3px track + fill. Fills once on arrival and then follows its value.
class _Bar extends StatelessWidget {
  const _Bar({
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
      borderRadius: BorderRadius.circular(2),
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
