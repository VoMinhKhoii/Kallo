/// The dock's entrance: `motion.section initial {opacity:0,y:10} → {1,0}` over
/// 0.45s, the same beat the web dashboard's sections fade in on.
///
/// Its own file because both the dock and the first-run card play it, and a
/// widget two siblings share cannot stay private to one of them.
library;

import 'package:flutter/material.dart';

/// motion.section initial {opacity:0,y:10} → {1,0} over 0.45s.
class FadeInDown extends StatefulWidget {
  const FadeInDown({required this.child, super.key});
  final Widget child;

  @override
  State<FadeInDown> createState() => _FadeInDownState();
}

class _FadeInDownState extends State<FadeInDown>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 450),
  )..forward();

  late final Animation<double> _opacity = CurvedAnimation(
    parent: _c,
    curve: Curves.easeOut,
  );

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _opacity,
      child: AnimatedBuilder(
        animation: _opacity,
        builder:
            (context, child) => Transform.translate(
              offset: Offset(0, 10 * (1 - _opacity.value)),
              child: child,
            ),
        child: widget.child,
      ),
    );
  }
}
