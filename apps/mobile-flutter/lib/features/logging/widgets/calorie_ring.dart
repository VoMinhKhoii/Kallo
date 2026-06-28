import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../features/dashboard/logic/dashboard_format.dart' show formatCount;
import '../../../shared/widgets/nham_text.dart';
import '../../../theme/nham_colors.dart';

/// The calorie ring fills with CONSUMED calories (`current / target`) — it fills
/// up as you eat, matching the dashboard ring, the week strip, and the heatmap
/// framing. The progress arc animates its sweep over 1000ms with
/// `cubic-bezier(0.16, 1, 0.3, 1)`.
///
/// Over target: the base arc completes in tan, then an overflow arc continues
/// past 12 o'clock in ~40%-alpha terracotta — never red, never a pill. The
/// default in-ring content shows the calories `left`, flipping to `over` when
/// past target. [center] overrides that content.
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
  double _fromRatio = 0;
  late double _ratio;

  double get _remaining => widget.target - widget.current;

  /// Consumed fraction — may exceed 1 (the painter splits base vs. overflow).
  double _computeRatio() => widget.target > 0 ? widget.current / widget.target : 0;

  @override
  void initState() {
    super.initState();
    _ratio = _computeRatio();
    _animation = Tween<double>(begin: 0, end: _ratio)
        .chain(CurveTween(curve: _curve))
        .animate(_controller);
    _controller.forward();
  }

  @override
  void didUpdateWidget(CalorieRing oldWidget) {
    super.didUpdateWidget(oldWidget);
    final nextRatio = _computeRatio();
    if (nextRatio != _ratio) {
      _fromRatio = _animation.value;
      _ratio = nextRatio;
      _animation = Tween<double>(begin: _fromRatio, end: _ratio)
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
                ratio: _animation.value,
                strokeWidth: widget.strokeWidth,
              ),
            ),
          ),
          widget.center ?? _DefaultCenter(remaining: _remaining),
        ],
      ),
    );
  }
}

class _DefaultCenter extends StatelessWidget {
  const _DefaultCenter({required this.remaining});

  /// target − consumed: positive = calories left, negative = over target.
  final double remaining;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.toString();
    final over = remaining < 0;
    final value = remaining.abs().round();
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        NhamText(
          formatCount(value, locale),
          variant: NhamTextVariant.numDisplay,
          style: const TextStyle(
            fontSize: 17,
            height: 1, // lineHeight 17 / fontSize 17
            letterSpacing: 0,
          ),
        ),
        const SizedBox(height: 2),
        NhamText(
          over ? tr('dashboard.over') : tr('dashboard.left'),
          variant: NhamTextVariant.eyebrow,
          style: const TextStyle(fontSize: 8, letterSpacing: 1.2),
        ),
      ],
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.ratio, required this.strokeWidth});

  final double ratio;
  final double strokeWidth;

  static const double _start = -math.pi / 2; // 12 o'clock.

  @override
  void paint(Canvas canvas, Size size) {
    // RN: radius 46 in a 100-unit viewbox → scale to the rendered size.
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (46 / 100) * size.width;
    final rect = Rect.fromCircle(center: center, radius: radius);

    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..color = NhamColors.track;
    canvas.drawCircle(center, radius, track);

    if (ratio <= 0) return;

    final base = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..color = NhamColors.accent;
    canvas.drawArc(
      rect,
      _start,
      2 * math.pi * ratio.clamp(0, 1).toDouble(),
      false,
      base,
    );

    // Over target — the overflow arc continues in terracotta @ ~40% alpha.
    if (ratio > 1) {
      final overflow = (ratio - 1).clamp(0, 1).toDouble();
      final over = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round
        ..color = NhamColors.danger.withValues(alpha: 0.4);
      canvas.drawArc(rect, _start, 2 * math.pi * overflow, false, over);
    }
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.ratio != ratio || old.strokeWidth != strokeWidth;
}
