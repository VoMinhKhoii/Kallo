import 'package:flutter/material.dart';

import '../../../theme/kallo_theme.dart';
import '../../logic/macro_composition.dart';

/// The stacked macro bar: one segment per macro, each sized by its share of the
/// meal's (or the day's) calories. Drawn in [kCompositionColors] — see that
/// file for why this surface gets the brighter pigments.
///
/// Zero-width segments are dropped rather than rendered at 0, so a meal with no
/// fat gives two segments meeting cleanly instead of a hairline seam.
class CompositionBar extends StatelessWidget {
  const CompositionBar({required this.segments, this.height = 8, super.key});

  final List<CompositionSegment> segments;
  final double height;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(KalloRadii.pill),
      child: SizedBox(
        height: height,
        child: Row(
          children: [
            for (final segment in segments)
              if (segment.pct > 0)
                Expanded(
                  flex: (segment.pct * 1000).round(),
                  child: ColoredBox(color: kCompositionColors[segment.key]!),
                ),
          ],
        ),
      ),
    );
  }
}
