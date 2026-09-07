import 'package:flutter/material.dart';

import '../../../theme/kallo_motion.dart';

/// The only thing that MOVES between onboarding screens: the title and the
/// controls under it.
///
/// The header, the bun and the CTA stay put — a wizard whose whole page slides
/// re-announces the brand and the progress bar six times, and the bun's blink
/// and breath restart with every step because its State is destroyed. Sliding
/// the content alone leaves one persistent tree and reads as the page ANSWERING
/// rather than as six pages in a row.
///
/// Outgoing and incoming run concurrently over [KalloMotion.page]: the old
/// content commits to leaving ([KalloEase.exit]) while the new one arrives on
/// the app's decelerating tail. 22% of the width is a deliberate sweep; a
/// smaller offset reads as a nudge, a larger one as a carousel.
///
/// Under reduced motion there is no travel at all — the two contents simply
/// cross-fade, which is the same information without the vestibular cost.
class OnboardingStepTransition extends StatelessWidget {
  const OnboardingStepTransition({
    super.key,
    required this.direction,
    required this.child,
  });

  /// +1 walking forward, -1 walking Back: the sweep mirrors with it.
  final int direction;

  /// Keyed by screen — that key is what tells the two apart mid-flight.
  final Widget child;

  /// Fraction of the region's width the content travels.
  static const double travel = 0.22;

  @override
  Widget build(BuildContext context) {
    final reduced = MediaQuery.disableAnimationsOf(context);
    return AnimatedSwitcher(
      duration: reduced ? KalloMotion.quick : KalloMotion.page,
      switchInCurve: reduced ? KalloEase.standard : KalloEase.decelerate,
      switchOutCurve: reduced ? KalloEase.standard : KalloEase.exit,
      transitionBuilder: (child, animation) {
        final fade = FadeTransition(opacity: animation, child: child);
        if (reduced) return fade;
        // The outgoing child's `animation` runs 1→0, so both ends are written
        // as "where this child sits at 0" and the tween carries them home.
        final incoming = child.key == this.child.key;
        final begin = Offset(direction * travel * (incoming ? 1 : -1), 0);
        return SlideTransition(
          position: Tween<Offset>(
            begin: begin,
            end: Offset.zero,
          ).animate(animation),
          child: fade,
        );
      },
      // Stacked and both full-size: the default switcher layout centres the
      // pair and would let the shorter screen drift up the page as it goes.
      layoutBuilder: (currentChild, previousChildren) => Stack(
        fit: StackFit.expand,
        children: [...previousChildren, if (currentChild != null) currentChild],
      ),
      child: child,
    );
  }
}
