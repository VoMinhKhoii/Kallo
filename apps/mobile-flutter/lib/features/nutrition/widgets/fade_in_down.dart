import 'package:flutter/material.dart';

/// Reanimated `FadeInDown` parity: opacity 0→1 + a downward y-offset that
/// settles to 0, easeOut, over [duration], staggered by [delay].
///
/// RN entrances use `FadeInDown.duration(d).delay(ms)`; the default 8px travel
/// matches the web `motion` `y:8` springs used across the nutrition sections.
class FadeInDown extends StatefulWidget {
  const FadeInDown({
    super.key,
    required this.child,
    this.duration = const Duration(milliseconds: 500),
    this.delay = Duration.zero,
    this.offset = 8,
  });

  final Widget child;
  final Duration duration;
  final Duration delay;

  /// Initial downward offset (px) that eases to 0.
  final double offset;

  @override
  State<FadeInDown> createState() => _FadeInDownState();
}

class _FadeInDownState extends State<FadeInDown>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: widget.duration,
  );

  late final Animation<double> _t = CurvedAnimation(
    parent: _controller,
    curve: Curves.easeOut,
  );

  @override
  void initState() {
    super.initState();
    if (widget.delay == Duration.zero) {
      _controller.forward();
    } else {
      Future.delayed(widget.delay, () {
        if (mounted) _controller.forward();
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _t,
      child: AnimatedBuilder(
        animation: _t,
        builder: (context, child) => Transform.translate(
          offset: Offset(0, widget.offset * (1 - _t.value)),
          child: child,
        ),
        child: widget.child,
      ),
    );
  }
}
