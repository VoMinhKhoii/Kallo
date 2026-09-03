import 'package:flutter/material.dart';

import '../../theme/kallo_motion.dart';

/// Slides + fades the pill nav off the bottom edge without changing its size.
///
/// Two callers want the bar out of the way — the keyboard coming up (the
/// composer owns the bottom edge then) and a downward scroll — and both need
/// the same guarantee: the bar stays BUILT while hidden. Collapsing it to a
/// zero-size box on the frame the offset starts animating killed both the
/// slide and the fade (it simply vanished), and, because the bar's laid-out
/// height is the bottom inset every tab body scrolls against, it would also
/// yank that inset to zero mid-gesture.
class PillNavVeil extends StatelessWidget {
  const PillNavVeil({super.key, required this.hidden, required this.child});

  final bool hidden;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return AnimatedSlide(
      duration: KalloMotion.quick,
      curve: KalloEase.standard,
      offset: hidden ? const Offset(0, 1) : Offset.zero,
      child: AnimatedOpacity(
        duration: KalloMotion.press,
        opacity: hidden ? 0 : 1,
        child: child,
      ),
    );
  }
}
