import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';

/// The pill that marks the selected segment of a [SegmentedStrip], drawn
/// where [SegmentedMotion] says it is.
///
/// Sized once, one segment wide; the position and the press are PAINT-time
/// transforms over it, so no frame of a slide runs layout.
class SegmentedThumb extends StatelessWidget {
  const SegmentedThumb({
    required this.position,
    required this.scale,
    required this.count,
    this.color = kCardSurface,
    this.rim,
    this.raised = true,
    super.key,
  });

  /// In segments, from [SegmentedMotion].
  final double position;
  final double scale;
  final int count;

  /// The pill's fill, and whether it casts the small shadow that lifts a white
  /// thumb off a warm track (a glass thumb over a photo has nothing to lift).
  final Color color;
  final bool raised;

  /// A hairline edge around the pill, so it reads as a raised piece rather
  /// than a flat fill; none when null.
  final Color? rim;

  /// The lift under a raised thumb: a soft spread plus a tight contact line,
  /// the two layers iOS draws under its segmented thumb.
  static const List<BoxShadow> lift = [
    BoxShadow(color: Color(0x12141413), blurRadius: 6, offset: Offset(0, 2)),
    BoxShadow(color: Color(0x0A141413), blurRadius: 1, offset: Offset(0, 0.5)),
  ];

  /// Where a held thumb (and its label) shrinks toward: the outer edge on an
  /// end segment, so it stays flush with the track, as iOS keeps it.
  static Alignment anchor(double position, int count) {
    final i = position.round();
    if (i <= 0) return Alignment.centerLeft;
    if (i >= count - 1) return Alignment.centerRight;
    return Alignment.center;
  }

  @override
  Widget build(BuildContext context) => Positioned.fill(
    child: FractionallySizedBox(
      alignment: Alignment.centerLeft,
      widthFactor: 1 / count,
      // Counts in units of the thumb's own width, so the position in
      // segments IS the offset.
      child: FractionalTranslation(
        translation: Offset(position, 0),
        child: Transform.scale(
          scale: scale,
          alignment: anchor(position, count),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: color,
              borderRadius: const BorderRadius.all(
                Radius.circular(KalloRadii.pill),
              ),
              border: rim == null ? null : Border.all(color: rim!, width: 0.5),
              boxShadow: raised ? lift : null,
            ),
          ),
        ),
      ),
    ),
  );
}
