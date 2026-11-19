import 'package:flutter/material.dart';

/// The pinned copy, laid out at [from] — it never re-flows — and carried onto
/// [to] by a paint-only transform as [animation] runs.
class AnchoredMenuPin extends StatelessWidget {
  const AnchoredMenuPin({
    super.key,
    required this.from,
    required this.to,
    required this.animation,
    required this.child,
  });

  final Rect from;
  final Rect to;
  final Animation<double> animation;
  final Widget child;

  @override
  Widget build(BuildContext context) => Positioned.fromRect(
    rect: from,
    child: IgnorePointer(
      child: AnimatedBuilder(
        animation: animation,
        builder: (_, copy) {
          final at = Rect.lerp(from, to, animation.value)!;
          final scale = at.width / from.width;
          return Transform(
            transform: Matrix4.translationValues(
              at.left - from.left,
              at.top - from.top,
              0,
            )..scaleByDouble(scale, scale, 1, 1),
            child: copy,
          );
        },
        // The copy is drawn above every Material in the app; without one of
        // its own its text wears the framework's yellow "no Material"
        // underline (seen on the simulator, 2026-10-23).
        child: Material(type: MaterialType.transparency, child: child),
      ),
    ),
  );
}
