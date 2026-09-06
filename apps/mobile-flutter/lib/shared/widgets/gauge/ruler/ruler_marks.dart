import 'package:flutter/material.dart';

import '../../../../theme/kallo_colors.dart';

/// Lays children at their anchor fractions across [width], each centred on its
/// own graduation.
class RulerBand extends StatelessWidget {
  const RulerBand({
    super.key,
    required this.majors,
    required this.width,
    required this.slotWidth,
    required this.child,
  });

  final List<double> majors;
  final double width;

  /// Each child gets its OWN slot of this width, centred on its graduation.
  /// Spanning the full strip and centring inside it looks identical but stacks
  /// every child on top of every other, so only the last one is tappable.
  final double slotWidth;

  final Widget Function(int index) child;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        for (final (i, fraction) in majors.indexed)
          Positioned(
            left: width * fraction - slotWidth / 2,
            width: slotWidth,
            top: 0,
            bottom: 0,
            child: Center(child: child(i)),
          ),
      ],
    );
  }
}

/// The needle's pointer cap: 9 wide, 7 tall.
const Size rulerNeedleCap = Size(9, 7);

/// The fixed reading mark: a pointer cap over a hairline through the scale,
/// drawn from its own top-left. WHERE it hangs is the host's business — the
/// portion sheet drops it below the band it measures, the pace ruler lifts it
/// by [rulerNeedleCap] so the cap rides above the strip (and must not clip).
class RulerNeedle extends StatelessWidget {
  const RulerNeedle({super.key, required this.bar});

  /// The bar under the cap.
  final double bar;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        CustomPaint(size: rulerNeedleCap, painter: _CapPainter()),
        Container(
          width: 2,
          height: bar,
          decoration: BoxDecoration(
            // The umber CTA colour, NOT `accentDark`. The needle is the one
            // mark that states the reading, and tan-on-cream measures 2.7:1 —
            // under the 3:1 floor for a non-text indicator. Umber is 6.3:1 and
            // is already the app's "this is the actionable thing" colour.
            color: KalloColors.btn,
            borderRadius: BorderRadius.circular(1),
          ),
        ),
      ],
    );
  }
}

class _CapPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawPath(
      Path()
        ..moveTo(0, 0)
        ..lineTo(size.width, 0)
        ..lineTo(size.width / 2, size.height)
        ..close(),
      Paint()..color = KalloColors.btn,
    );
  }

  @override
  bool shouldRepaint(_CapPainter oldDelegate) => false;
}
