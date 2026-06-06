/// CalorieRing — RN port of `components/logging/calorie-ring.tsx`.
///
/// Shows REMAINING calories as the fill fraction. The progress arc animates its
/// sweep (the RN `strokeDashoffset` tween) over 1000ms with the signature
/// `cubic-bezier(0.16, 1, 0.3, 1)` ease. The dashboard passes a [center] node
/// (a flame icon) to override the default in-ring remaining/“left” content.
library;

import 'package:flutter/material.dart';

import '../../../theme/nham_colors.dart';
import '../../../theme/nham_typography.dart';

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
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1000),
  );
  late Animation<double> _fill = _build();

  // cubic-bezier(0.16, 1, 0.3, 1) — the signature "ease-out-expo-ish" curve.
  static const Curve _ease = Cubic(0.16, 1, 0.3, 1);

  double get _pct {
    final remaining = (widget.target - widget.current).clamp(0, double.infinity);
    return widget.target > 0
        ? (remaining / widget.target).clamp(0, 1).toDouble()
        : 0;
  }

  Animation<double> _build() => Tween<double>(begin: 0, end: _pct).animate(
        CurvedAnimation(parent: _controller, curve: _ease),
      );

  @override
  void initState() {
    super.initState();
    _controller.forward();
  }

  @override
  void didUpdateWidget(CalorieRing oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.current != widget.current ||
        oldWidget.target != widget.target) {
      _fill = _build();
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
    final remaining = (widget.target - widget.current).clamp(0, double.infinity);
    return SizedBox(
      width: widget.size,
      height: widget.size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          AnimatedBuilder(
            animation: _fill,
            builder: (context, _) => CustomPaint(
              size: Size(widget.size, widget.size),
              painter: _RingPainter(
                fraction: _fill.value,
                strokeWidth: widget.strokeWidth,
              ),
            ),
          ),
          widget.center ?? _DefaultCenter(remaining: remaining.toDouble()),
        ],
      ),
    );
  }
}

class _DefaultCenter extends StatelessWidget {
  const _DefaultCenter({required this.remaining});

  final double remaining;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          remaining.round().toString(),
          style: NhamTextStyles.serifSemiBold(fontSize: 17, height: 1)
              .copyWith(color: NhamColors.text, letterSpacing: 0),
        ),
        const SizedBox(height: 2),
        Text(
          'LEFT',
          style: NhamTextStyles.sansBold(fontSize: 8)
              .copyWith(letterSpacing: 1.2, color: NhamColors.stone),
        ),
      ],
    );
  }
}

/// Draws the track ring + a rounded progress arc starting at 12 o'clock
/// (`rotate(-90)`), sweeping clockwise for [fraction] of the circle. Stroke
/// width is constant in pixels (RN `vectorEffect="non-scaling-stroke"`).
class _RingPainter extends CustomPainter {
  _RingPainter({required this.fraction, required this.strokeWidth});

  final double fraction;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    // RN viewBox 0 0 100 100, r=46, center 50 → radius scales with size.
    final radius = (size.width / 2) * (46 / 50);

    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..color = NhamColors.track;
    canvas.drawCircle(center, radius, track);

    if (fraction <= 0) return;

    final arc = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..color = NhamColors.accent;

    const start = -3.141592653589793 / 2; // -90° (12 o'clock).
    final sweep = 2 * 3.141592653589793 * fraction;
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      start,
      sweep,
      false,
      arc,
    );
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.fraction != fraction || old.strokeWidth != strokeWidth;
}
