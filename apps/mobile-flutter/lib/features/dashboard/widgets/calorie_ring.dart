/// CalorieRing — the dashboard/logging calorie ring.
///
/// The arc fills with CONSUMED calories (`current / target`) — it fills up as
/// you eat, matching the week-strip rings and the heatmap framing. The progress
/// arc animates its sweep over 1000ms with the signature
/// `cubic-bezier(0.16, 1, 0.3, 1)` ease.
///
/// Over target: the base arc completes a full circle in tan, then an overflow
/// arc continues past 12 o'clock in ~40%-alpha terracotta for the overshoot
/// fraction — an honest, judgment-free visual. Never red, never a pill, never
/// an icon.
///
/// The dashboard passes a [center] node (a flame icon) to override the default
/// in-ring remaining/over content.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../theme/nham_colors.dart';
import '../../../theme/nham_typography.dart';
import '../logic/dashboard_format.dart';

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

  /// Consumed fraction of the target — can exceed 1 when over target. The
  /// painter splits the base (0..1, tan) from the overflow (>1, terracotta).
  double get _consumedRatio =>
      widget.target > 0 ? (widget.current / widget.target) : 0;

  Animation<double> _build() => Tween<double>(begin: 0, end: _consumedRatio)
      .animate(CurvedAnimation(parent: _controller, curve: _ease));

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
    final remaining = widget.target - widget.current;
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
                ratio: _fill.value,
                strokeWidth: widget.strokeWidth,
              ),
            ),
          ),
          widget.center ?? _DefaultCenter(remaining: remaining),
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
        Text(
          formatCount(value, locale),
          style: NhamTextStyles.serifSemiBold(fontSize: 17, height: 1)
              .copyWith(color: NhamColors.text, letterSpacing: 0),
        ),
        const SizedBox(height: 2),
        Text(
          (over ? tr('dashboard.over') : tr('dashboard.left')).toUpperCase(),
          style: NhamTextStyles.sansBold(fontSize: 8)
              .copyWith(letterSpacing: 1.2, color: NhamColors.stone),
        ),
      ],
    );
  }
}

/// Draws the track ring, the consumed arc (tan, 0..1 of the circle, from 12
/// o'clock clockwise) and — when [ratio] > 1 — an overflow arc continuing past
/// 12 o'clock in ~40%-alpha terracotta for the overshoot.
class _RingPainter extends CustomPainter {
  _RingPainter({required this.ratio, required this.strokeWidth});

  final double ratio;
  final double strokeWidth;

  static const double _tau = 2 * 3.141592653589793;
  static const double _start = -3.141592653589793 / 2; // -90° (12 o'clock).

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    // RN viewBox 0 0 100 100, r=46, center 50 → radius scales with size.
    final radius = (size.width / 2) * (46 / 50);
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
    canvas.drawArc(rect, _start, _tau * ratio.clamp(0, 1).toDouble(), false, base);

    // Over target — the overflow arc continues in terracotta @ ~40% alpha.
    if (ratio > 1) {
      final overflow = (ratio - 1).clamp(0, 1).toDouble();
      final over = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round
        ..color = NhamColors.danger.withValues(alpha: 0.4);
      canvas.drawArc(rect, _start, _tau * overflow, false, over);
    }
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.ratio != ratio || old.strokeWidth != strokeWidth;
}
