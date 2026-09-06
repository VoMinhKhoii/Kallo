import 'package:flutter/material.dart';

import '../../../../theme/kallo_colors.dart';

/// Paints the ruler face for a scrolling strip: a top edge with graduations
/// hanging from it, tall at each anchor and short between them. The strip
/// scrolls under a fixed needle, so there is no thumb position to tint against
/// — graduations are one weight, and "how much" is read from the needle.
class RulerPainter extends CustomPainter {
  const RulerPainter({required this.majors, required this.graduations});

  /// Anchor positions as 0–1 fractions of the strip.
  final List<double> majors;

  /// Minor graduation count across the whole strip.
  final int graduations;

  @override
  void paint(Canvas canvas, Size size) {
    final edge = Paint()
      ..color = KalloColors.border
      ..strokeWidth = 1;
    canvas.drawLine(const Offset(0, 0.5), Offset(size.width, 0.5), edge);

    final minorHeight = size.height * 0.42;
    final pitch = 1 / graduations;

    void tick(double fraction, {required bool major}) {
      final x = size.width * fraction;
      canvas.drawLine(
        Offset(x, 0),
        Offset(x, major ? size.height : minorHeight),
        Paint()
          ..color = major ? KalloColors.text30 : KalloColors.border
          ..strokeWidth = major ? 1.5 : 1,
      );
    }

    for (var i = 0; i <= graduations; i += 1) {
      final fraction = i * pitch;
      // Leave the slot to the major that owns it, so the two never double up.
      if (!majors.any((m) => (m - fraction).abs() < pitch * 0.4)) {
        tick(fraction, major: false);
      }
    }
    for (final major in majors) {
      tick(major, major: true);
    }
  }

  @override
  bool shouldRepaint(RulerPainter old) =>
      old.majors != majors || old.graduations != graduations;
}
