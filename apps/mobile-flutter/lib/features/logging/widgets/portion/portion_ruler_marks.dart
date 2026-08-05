import 'package:flutter/material.dart';

import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import 'portion_ruler_face.dart';

/// Lays children at their anchor fractions across [width], each centred on its
/// own graduation.
class PortionRulerBand extends StatelessWidget {
  const PortionRulerBand({
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

/// The fixed reading mark: a pointer cap over a hairline through the scale.
class PortionRulerNeedle extends StatelessWidget {
  const PortionRulerNeedle({
    super.key,
    required this.height,
  });

  final double height;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(height: height - 7),
        CustomPaint(
          size: const Size(9, 7),
          painter: _CapPainter(),
        ),
        Container(
          width: 2,
          height: portionRulerHeight + NhamSpacing.sp1,
          decoration: BoxDecoration(
            color: NhamColors.accentDark,
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
      Paint()..color = NhamColors.accentDark,
    );
  }

  @override
  bool shouldRepaint(_CapPainter oldDelegate) => false;
}
