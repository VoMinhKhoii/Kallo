import 'package:flutter/material.dart';

/// Reanimated-style entrance animations used across the logging feed.
///
/// These replicate the RN `react-native-reanimated` layout entrances (FadeIn,
/// FadeInDown, FadeInLeft, FadeInUp, ZoomIn) with a one-shot
/// [AnimationController]: opacity 0→1 plus an optional translation/scale, after
/// an optional [delay]. No reduce-motion seam (Flutter has no direct equivalent
/// wired in this app).

enum _EntranceKind { fade, down, up, left, zoom }

class _Entrance extends StatefulWidget {
  const _Entrance({
    required this.child,
    required this.kind,
    required this.duration,
    this.delay = Duration.zero,
    this.offset = 16,
  });

  final Widget child;
  final _EntranceKind kind;
  final Duration duration;
  final Duration delay;
  final double offset;

  @override
  State<_Entrance> createState() => _EntranceState();
}

class _EntranceState extends State<_Entrance>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c =
      AnimationController(vsync: this, duration: widget.duration);
  late final Animation<double> _curved =
      CurvedAnimation(parent: _c, curve: Curves.easeOut);

  @override
  void initState() {
    super.initState();
    if (widget.delay == Duration.zero) {
      _c.forward();
    } else {
      Future<void>.delayed(widget.delay, () {
        if (mounted) _c.forward();
      });
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _curved,
      builder: (context, child) {
        final t = _curved.value;
        Offset translate = Offset.zero;
        double scale = 1;
        switch (widget.kind) {
          case _EntranceKind.fade:
            break;
          case _EntranceKind.down:
            translate = Offset(0, (1 - t) * widget.offset);
          case _EntranceKind.up:
            translate = Offset(0, (1 - t) * -widget.offset);
          case _EntranceKind.left:
            translate = Offset((1 - t) * -widget.offset, 0);
          case _EntranceKind.zoom:
            scale = 0.85 + t * 0.15;
        }
        return Opacity(
          opacity: t.clamp(0, 1),
          child: Transform.translate(
            offset: translate,
            child: scale == 1
                ? child
                : Transform.scale(scale: scale, child: child),
          ),
        );
      },
      child: widget.child,
    );
  }
}

/// Opacity 0→1.
class FadeIn extends StatelessWidget {
  const FadeIn({
    super.key,
    required this.child,
    this.duration = const Duration(milliseconds: 200),
    this.delay = Duration.zero,
  });
  final Widget child;
  final Duration duration;
  final Duration delay;

  @override
  Widget build(BuildContext context) => _Entrance(
        kind: _EntranceKind.fade,
        duration: duration,
        delay: delay,
        child: child,
      );
}

/// Opacity 0→1 + slide up from below.
class FadeInDown extends StatelessWidget {
  const FadeInDown({
    super.key,
    required this.child,
    this.duration = const Duration(milliseconds: 300),
    this.delay = Duration.zero,
  });
  final Widget child;
  final Duration duration;
  final Duration delay;

  @override
  Widget build(BuildContext context) => _Entrance(
        kind: _EntranceKind.down,
        duration: duration,
        delay: delay,
        child: child,
      );
}

/// Opacity 0→1 + slide down from above.
class FadeInUp extends StatelessWidget {
  const FadeInUp({
    super.key,
    required this.child,
    this.duration = const Duration(milliseconds: 350),
    this.delay = Duration.zero,
    this.offset = 8,
  });
  final Widget child;
  final Duration duration;
  final Duration delay;
  final double offset;

  @override
  Widget build(BuildContext context) => _Entrance(
        kind: _EntranceKind.up,
        duration: duration,
        delay: delay,
        offset: offset,
        child: child,
      );
}

/// Opacity 0→1 + slide in from the left (the streaming waterfall).
class FadeInLeft extends StatelessWidget {
  const FadeInLeft({
    super.key,
    required this.child,
    this.duration = const Duration(milliseconds: 250),
    this.delay = Duration.zero,
    this.offset = 16,
  });
  final Widget child;
  final Duration duration;
  final Duration delay;
  final double offset;

  @override
  Widget build(BuildContext context) => _Entrance(
        kind: _EntranceKind.left,
        duration: duration,
        delay: delay,
        offset: offset,
        child: child,
      );
}

/// Opacity 0→1 + scale-in (the empty-state icon, edit/done pill swap).
class ZoomIn extends StatelessWidget {
  const ZoomIn({
    super.key,
    required this.child,
    this.duration = const Duration(milliseconds: 300),
    this.delay = Duration.zero,
  });
  final Widget child;
  final Duration duration;
  final Duration delay;

  @override
  Widget build(BuildContext context) => _Entrance(
        kind: _EntranceKind.zoom,
        duration: duration,
        delay: delay,
        child: child,
      );
}
