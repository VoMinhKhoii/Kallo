import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../logic/display_format.dart' show formatCount;
import '../../../theme/calm_tokens.dart';
import 'ring_painter.dart';

/// The calorie ring fills with CONSUMED calories (`current / target`) — it fills
/// up as you eat, matching the dashboard ring, the week strip, and the heatmap
/// framing. The progress arc animates its sweep over 1000ms with
/// `cubic-bezier(0.16, 1, 0.3, 1)`.
///
/// Over target: the base arc completes in tan, then an overflow arc continues
/// past 12 o'clock in ~40%-alpha [KalloColors.offTarget] — never red, never a
/// pill. The default in-ring content shows the calories `left`, flipping to
/// `over` when past target. [center] overrides that content (the dashboard
/// passes a flame icon, so it never renders the default).
class CalorieRing extends StatefulWidget {
  const CalorieRing({
    super.key,
    required this.current,
    required this.target,
    this.size = 78,
    this.strokeWidth = 3,
    this.center,
  }) : refillFromEmpty = false;

  /// The dashboard's ring: the sweep restarts from empty on every change.
  const CalorieRing.refilling({
    super.key,
    required this.current,
    required this.target,
    this.size = 78,
    this.strokeWidth = 3,
    this.center,
  }) : refillFromEmpty = true;

  final double current;
  final double target;
  final double size;
  final double strokeWidth;
  final Widget? center;

  /// Whether a change in [current]/[target] restarts the sweep from empty
  /// (`CalorieRing.refilling`, the dashboard) or continues it from where the
  /// arc sits (the default, logging). The two copies of this widget had one
  /// behaviour each; kept apart because the difference is visible on screen.
  final bool refillFromEmpty;

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
  late double _ratio;

  double get _remaining => widget.target - widget.current;

  /// Consumed fraction — may exceed 1 (the painter splits base vs. overflow).
  double _computeRatio() =>
      widget.target > 0 ? widget.current / widget.target : 0;

  Animation<double> _tween(double from) => Tween<double>(begin: from, end: _ratio)
      .chain(CurveTween(curve: _curve))
      .animate(_controller);

  @override
  void initState() {
    super.initState();
    _ratio = _computeRatio();
    _animation = _tween(0);
    _controller.forward();
  }

  @override
  void didUpdateWidget(CalorieRing oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Logging re-animated only when the ratio moved; the dashboard on any
    // current/target change. Differs only when both move in proportion.
    final nextRatio = _computeRatio();
    if (nextRatio == _ratio &&
        !(widget.refillFromEmpty &&
            (oldWidget.current != widget.current ||
                oldWidget.target != widget.target))) {
      return;
    }
    final from = widget.refillFromEmpty ? 0.0 : _animation.value;
    _ratio = nextRatio;
    _animation = _tween(from);
    _controller
      ..reset()
      ..forward();
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
              painter: CalorieRingPainter(
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
        Text(
          formatCount(value, locale),
          // Calm: a sans metric value, not a serif moment.
          style: dashValue().copyWith(height: 1),
        ),
        const SizedBox(height: 2),
        Text(
          // Lower-cased explicitly: the strings disagree ("left" vs "Over"),
          // and lower keeps Vietnamese ("còn lại") inside the fixed 78px ring.
          (over ? tr('dashboard.over') : tr('dashboard.left')).toLowerCase(),
          style: dashMeta(),
        ),
      ],
    );
  }
}
