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
        // Explicitly full-width. The Row below carries only Expanded children,
        // which gives it ZERO intrinsic width — so anywhere an ancestor sizes
        // by intrinsics rather than by the incoming constraint, relying on
        // Row's mainAxisSize.max collapses the bar to nothing. It keeps its
        // height while doing so, which is why the symptom is a gap in the
        // layout rather than a missing widget.
        width: double.infinity,
        height: height,
        child: Row(
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
