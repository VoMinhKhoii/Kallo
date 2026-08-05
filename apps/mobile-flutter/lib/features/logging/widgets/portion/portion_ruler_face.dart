import 'package:flutter/material.dart';

import '../../../../theme/nham_colors.dart';

/// The measuring-ruler face the portion slider is drawn on, and the needle that
/// reads it.
///
/// **Deliberate divergence from web.** The web picker is a plain Radix slider —
/// a bar and a round thumb — which is the right control for a pointer and a
/// keyboard. On a touch surface there is no hover, no arrow key and no focus
/// ring, so the bar carries none of the affordance it does on the web, and the
/// one thing the sheet exists to communicate (how much food) is left entirely
/// to the number. A graduated scale states the amount in the control itself,
/// and gives the drag something to travel over. Recorded in
/// `apps/docs/mobile/architecture.md`; web keeps its slider.
///
/// Geometry is unchanged: majors sit exactly on the anchor positions, so the
/// silhouettes above and the gram labels below still line up with the scale and
/// with each other.

/// Clearance between the silhouettes and the needle's pointer cap.
const double portionNeedleGap = 6;

/// Height of the ruler band. Replaces the web track's `h-1.5`.
const double portionRulerHeight = 22;

/// Reserved thumb width. NOT the needle's visual width — it is what Material
/// insets the track by (`max(thumb, overlay) / 2`), and therefore what the
/// glyph row and the gram labels pad by. Changing it moves the scale out from
/// under the silhouettes.
const double portionThumbRadius = 8;

/// Minor graduations per anchor, setting the scale's density. Majors are drawn
/// at their exact positions rather than snapped to this grid: the piece ruler's
/// anchors are evenly spaced in position space and land on it anyway, but a
/// container's do not (a tier-4 bowl is far more than four tier-1 bowls), and a
/// major tick nudged onto the nearest minor would point at the wrong grams.
const int _minorsPerMajor = 8;

/// Total graduations across the whole scale, for [majorCount] anchors.
int portionGraduationCount(int majorCount) => _minorsPerMajor * majorCount;

double _minorPitch(int majorCount) => 1 / portionGraduationCount(majorCount);

/// The ruler face: a top edge with graduations hanging from it, tall at the
/// vessel tiers and short between them.
class PortionRulerTrack extends SliderTrackShape with BaseSliderTrackShape {
  const PortionRulerTrack({required this.majors});

  /// Anchor positions as 0–1 fractions of the track.
  final List<double> majors;

  /// Square, not rounded — the ONLY reader of this flag is `_calcThumbCenter`
  /// (slider.dart), which for a rounded track lays the thumb out over
  /// `width - trackHeight` and re-centres it, parking the needle up to half a
  /// track-height away from the graduation it just snapped to.
  @override
  bool get isRounded => false;

  @override
  void paint(
    PaintingContext context,
    Offset offset, {
    required RenderBox parentBox,
    required SliderThemeData sliderTheme,
    required Animation<double> enableAnimation,
    required Offset thumbCenter,
    required TextDirection textDirection,
    Offset? secondaryOffset,
    bool isDiscrete = false,
    bool isEnabled = false,
    double additionalActiveTrackHeight = 2,
  }) {
    final rect = getPreferredRect(
      parentBox: parentBox,
      offset: offset,
      sliderTheme: sliderTheme,
      isEnabled: isEnabled,
      isDiscrete: isDiscrete,
    );
    final canvas = context.canvas;

    // The ruler's edge. Graduations hang off it, and the gram labels sit below
    // the band — the reading direction of a real rule.
    final edge = Paint()
      ..color = NhamColors.border
      ..strokeWidth = 1;
    canvas.drawLine(
      Offset(rect.left, rect.top + 0.5),
      Offset(rect.right, rect.top + 0.5),
      edge,
    );

    if (majors.isEmpty) return;
    final pitch = _minorPitch(majors.length);
    final majorHeight = rect.height;
    final minorHeight = rect.height * 0.42;

    // A graduation left of the needle is "measured" and reads in ink; ahead of
    // it the scale stays quiet. This is the progress cue a filled bar used to
    // give, without a bar competing with the silhouettes above.
    Color tint(double x, {required bool major}) {
      final passed = x <= thumbCenter.dx + 0.5;
      if (major) return passed ? NhamColors.text : NhamColors.text30;
      return passed ? NhamColors.text40 : NhamColors.border;
    }

    void graduation(double fraction, {required bool major}) {
      final x = rect.left + rect.width * fraction;
      canvas.drawLine(
        Offset(x, rect.top),
        Offset(x, rect.top + (major ? majorHeight : minorHeight)),
        Paint()
          ..color = tint(x, major: major)
          ..strokeWidth = major ? 1.5 : 1,
      );
    }

    final steps = (1 / pitch).round();
    for (var i = 0; i <= steps; i += 1) {
      final fraction = i * pitch;
      // Leave the slot to the major that owns it, so the two never double up
      // into one thick smudge.
      final crowded = majors.any((m) => (m - fraction).abs() < pitch * 0.4);
      if (!crowded) graduation(fraction, major: false);
    }
    for (final major in majors) {
      graduation(major, major: true);
    }
  }
}

/// The needle that reads the scale: a full-height line under a small pointer
/// cap, in the accent — the one non-text moment the palette spends tan on.
class PortionNeedleThumb extends SliderComponentShape {
  const PortionNeedleThumb({required this.color});

  final Color color;

  /// Width is what the track inset is derived from — see [portionThumbRadius].
  /// The needle paints far narrower than the box it reserves.
  @override
  Size getPreferredSize(bool isEnabled, bool isDiscrete) =>
      const Size(2 * portionThumbRadius, portionRulerHeight);

  @override
  void paint(
    PaintingContext context,
    Offset center, {
    required Animation<double> activationAnimation,
    required Animation<double> enableAnimation,
    required bool isDiscrete,
    required TextPainter labelPainter,
    required RenderBox parentBox,
    required SliderThemeData sliderTheme,
    required TextDirection textDirection,
    required double value,
    required double textScaleFactor,
    required Size sizeWithOverflow,
  }) {
    final canvas = context.canvas;
    final top = center.dy - portionRulerHeight / 2;
    final bottom = top + portionRulerHeight;
    final paint = Paint()..color = color;

    // Pointer cap: a downward triangle sitting ON the ruler's edge, so the
    // needle reads as pointing AT a graduation rather than covering it.
    const capWidth = 9.0;
    const capHeight = 7.0;
    canvas.drawPath(
      Path()
        ..moveTo(center.dx - capWidth / 2, top - capHeight)
        ..lineTo(center.dx + capWidth / 2, top - capHeight)
        ..lineTo(center.dx, top)
        ..close(),
      paint,
    );

    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTRB(center.dx - 1, top, center.dx + 1, bottom),
        const Radius.circular(1),
      ),
      paint,
    );
  }
}
