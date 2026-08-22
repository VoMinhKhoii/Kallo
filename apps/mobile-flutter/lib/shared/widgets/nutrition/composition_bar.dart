import 'package:flutter/material.dart';

import '../../../theme/kallo_theme.dart';
import '../../logic/macro_composition.dart';

/// The stacked macro bar: one segment per macro, each sized by its share of the
/// meal's (or the day's) calories. Drawn in [kCompositionColors].
///
/// The defaults are the nutrition page's: 8pt, segments meeting flush, full
/// pigment. That surface draws ONE bar per screen, large, where saturation
/// costs nothing. A surface repeating the bar down a list pays for it on every
/// row, so [height], [gap] and [opacity] exist to take the weight back out —
/// see the Circle feed, which draws it half as tall and softened.
///
/// Zero-width segments are dropped rather than rendered at 0, so a meal with no
/// fat gives two segments meeting cleanly instead of a hairline seam.
class CompositionBar extends StatelessWidget {
  const CompositionBar({
    required this.segments,
    this.height = 8,
    this.gap = 0,
    this.opacity = 1,
    super.key,
  });

  /// The variant for a surface that repeats the bar down a LIST — the Circle
  /// feed, the dashboard's meal rows — rather than drawing one per screen.
  ///
  /// Shorter, gapped and softened, because the same mark at full weight read as
  /// candy stripes once it appeared on every row. Height is a trade in both
  /// directions: at 4 the bar is 80:1 and reads as a decorative rule under the
  /// calorie figure rather than as a composition; 6 keeps it quiet while still
  /// reading as three parts of something.
  const CompositionBar.compact({required this.segments, super.key})
    : height = 6,
      gap = 2,
      opacity = 0.8;

  final List<CompositionSegment> segments;
  final double height;

  /// Transparent gutter between segments, showing the surface behind. Reads the
  /// split as three marks rather than one gradient-ish band.
  final double gap;

  /// Pigment alpha. Below 1 the segments lighten toward the page, which is how
  /// a repeated bar stops shouting without leaving the palette.
  final double opacity;

  @override
  Widget build(BuildContext context) {
    final visible = segments.where((segment) => segment.pct > 0).toList();
    return ClipRRect(
      borderRadius: BorderRadius.circular(KalloRadii.pill),
      child: SizedBox(
        // Belt-and-braces on the main axis: the Row carries only Expanded
        // children, so it has zero intrinsic width and would collapse under an
        // ancestor that sizes by intrinsics rather than by the constraint.
        width: double.infinity,
        height: height,
        child: Row(
          // Load-bearing. Expanded ties the MAIN axis; the cross axis is still
          // handed to children loosely, and a childless ColoredBox collapses to
          // zero height under a loose constraint. Without stretch every segment
          // paints at width × 0: the bar reserves its height and draws nothing,
          // which looks like a gap in the layout rather than a broken widget.
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < visible.length; i++) ...[
              if (i > 0 && gap > 0) SizedBox(width: gap),
              Expanded(
                flex: (visible[i].pct * 1000).round(),
                child: ColoredBox(
                  color: kCompositionColors[visible[i].key]!.withValues(
                    alpha: opacity,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
