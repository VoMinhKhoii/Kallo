import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../shared/widgets/nham_text.dart';
import '../../../theme/nham_colors.dart';

/// The calorie ring shows REMAINING calories as the fill fraction (matches
/// web's shared/calorie-ring). The progress arc animates its
/// `strokeDashoffset` over 1000ms with `cubic-bezier(0.16, 1, 0.3, 1)`.
///
/// RN geometry: a 100-unit viewbox, radius 46, centered, with a
/// `non-scaling-stroke` of [strokeWidth] px at the rendered [size]. [center]
/// overrides the default in-ring content (the remaining number + "left"
/// eyebrow), mirroring the RN `center` prop.
class CalorieRing extends StatefulWidget {
  const CalorieRing({
    super.key,
    required this.current,
    required this.target,
    this.size = 78,
    this.strokeWidth = 3,
    this.center,
  });

  final double current;
  final double target;
  final double size;
  final double strokeWidth;
  final Widget? center;

  @override
  State<CalorieRing> createState() => _CalorieRingState();
}

class _CalorieRingState extends State<CalorieRing>
    with SingleTickerProviderStateMixin {
  // RN easing: Easing.bezier(0.16, 1, 0.3, 1), 1000ms.
  static const Curve _curve = Cubic(0.16, 1, 0.3, 1);

  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1000),
  );
  late Animation<double> _animation;
  double _fromPct = 0;
  late double _pct;

  double get _remaining =>
      math.max(0, widget.target - widget.current);
  double _computePct() =>
      widget.target > 0 ? math.min(_remaining / widget.target, 1) : 0;

  @override
  void initState() {
    super.initState();
    _pct = _computePct();
    _animation = Tween<double>(begin: 0, end: _pct)
        .chain(CurveTween(curve: _curve))
        .animate(_controller);
    _controller.forward();
  }

  @override
  void didUpdateWidget(CalorieRing oldWidget) {
    super.didUpdateWidget(oldWidget);
    final nextPct = _computePct();
    if (nextPct != _pct) {
      _fromPct = _animation.value;
      _pct = nextPct;
      _animation = Tween<double>(begin: _fromPct, end: _pct)
          .chain(CurveTween(curve: _curve))
          .animate(_controller);
      _controller
        ..reset()
        ..forward();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final remainingLabel = _remaining.round().toString();
    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          AnimatedBuilder(
            animation: _animation,
            builder: (context, _) => CustomPaint(
              size: Size(widget.size, widget.size),
              painter: _RingPainter(
                pct: _animation.value,
                strokeWidth: widget.strokeWidth,
              ),
            ),
          ),
          widget.center ??
              _DefaultCenter(remainingLabel: remainingLabel),
        ],
      ),
    );
  }
}

class _DefaultCenter extends StatelessWidget {
  const _DefaultCenter({required this.remainingLabel});
  final String remainingLabel;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        NhamText(
          remainingLabel,
          variant: NhamTextVariant.numDisplay,
          style: const TextStyle(
            fontSize: 17,
            height: 1, // lineHeight 17 / fontSize 17
            letterSpacing: 0,
          ),
        ),
        const SizedBox(height: 2),
        const NhamText(
          'left',
          variant: NhamTextVariant.eyebrow,
          style: TextStyle(fontSize: 8, letterSpacing: 1.2),
        ),
      ],
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.pct, required this.strokeWidth});

  final double pct;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    // RN: radius 46 in a 100-unit viewbox → scale to the rendered size.
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (46 / 100) * size.width;

    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..color = NhamColors.track;
    canvas.drawCircle(center, radius, track);

    if (pct <= 0) return;

    final arc = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..color = NhamColors.accent;

    // Start at -90° (12 o'clock), sweep clockwise by pct of the full circle.
    const startAngle = -math.pi / 2;
    final sweepAngle = 2 * math.pi * pct;
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      startAngle,
      sweepAngle,
      false,
      arc,
    );
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.pct != pct || old.strokeWidth != strokeWidth;
}
