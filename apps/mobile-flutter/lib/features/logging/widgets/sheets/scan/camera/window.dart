import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import 'mode_chip.dart';

/// Where the camera looks for its target, in the full-screen preview's own
/// coordinates — one rect for decoding and for the outline the user aims with,
/// so a neighbouring package outside the outline can never win the scan.
///
/// A barcode is a wide strip; a nutrition table is a tall panel. Both sit a
/// little above centre, clear of the mode chip and the tools below.
Rect scanWindowFor(ScanType type, Size size) {
  final center = Offset(size.width / 2, size.height * 0.45);
  return switch (type) {
    ScanType.barcode => Rect.fromCenter(
      center: center,
      width: size.width * 0.64,
      height: size.width * 0.64 * 0.544,
    ),
    ScanType.label => Rect.fromCenter(
      center: center,
      width: size.width * 0.66,
      height: math.min(size.height * 0.56, size.width * 0.66 * 1.9),
    ),
  };
}

/// The scan window: a thin white rounded outline, the room around it dimmed
/// only lightly — the owner wants to see the surroundings and the thing being
/// scanned, so nothing inside the window is tinted. [solid] is the frozen
/// frame's firmer outline while a code is looked up or a label read.
class ScanOutlinePainter extends CustomPainter {
  const ScanOutlinePainter({required this.window, this.solid = false});

  final Rect window;
  final bool solid;

  static const double radius = 24;

  @override
  void paint(Canvas canvas, Size size) {
    final rrect = RRect.fromRectAndRadius(
      window,
      const Radius.circular(radius),
    );
    final outside =
        Path()
          ..fillType = PathFillType.evenOdd
          ..addRect(Offset.zero & size)
          ..addRRect(rrect);
    canvas.drawPath(outside, Paint()..color = const Color(0x2E000000));
    canvas.drawRRect(
      rrect,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = solid ? 2 : 1.5
        ..color = Color.fromRGBO(255, 255, 255, solid ? 1 : 0.8),
    );
  }

  @override
  bool shouldRepaint(ScanOutlinePainter old) =>
      old.window != window || old.solid != solid;
}
