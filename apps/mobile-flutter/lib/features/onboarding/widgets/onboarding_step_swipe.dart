import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// A right-swipe on a wizard screen goes back one, the same as the chevron.
///
/// **Wrapping, never an overlay.** Ancestor recognizers join the gesture arena
/// AFTER their descendants, so a detector that wraps the content loses to
/// anything horizontal inside it — [PaceRuler] on the goal screen today, and
/// whatever a future screen adds — with nothing to register and nothing to
/// maintain. It also wins over the app-wide route drag
/// (`shell/nav/swipe_back/`), which wraps the whole page and is therefore one
/// level further out: without this, a swipe on screen 3 would pop `/onboarding`
/// off to `/start` instead of stepping back to screen 2.
///
/// **Back only, and by threshold rather than by tracking.** Forward is a
/// commit: `_leave` posts to the server, can be blocked by an invalid metric,
/// and on failure toasts and stays put — none of which a drag that visually
/// tracked the next screen in could honour. And the screens do not slide with
/// the finger in the first place: [OnboardingStepTransition] sweeps the content
/// 22% of the width under an `AnimatedSwitcher` with no controller to drive, so
/// 1:1 tracking would read as broken. A fling, or a drag past a fifth of the
/// width, commits.
///
/// [onBack] being null is the only gate it needs: the wizard already passes
/// null while a save is in flight and on screen 1 of a mandatory run, so a
/// silent no-op is the correct behaviour in both.
class OnboardingStepSwipe extends StatefulWidget {
  const OnboardingStepSwipe({super.key, required this.onBack, required this.child});

  /// One screen back, or null where there is nowhere to go.
  final VoidCallback? onBack;

  final Widget child;

  /// Fraction of the region's width a slow drag must cover to commit. A fifth,
  /// against the transition's 22% sweep — far enough not to fire on a stray
  /// horizontal wobble during a vertical scroll.
  static const double commitFraction = 0.2;

  /// Pixels per second past which the drag is a flick and distance stops
  /// mattering. Deliberately well above Flutter's `kMinFlingVelocity` (50),
  /// which is a "did it move at all" floor: at 50 a lazy horizontal wobble
  /// during a vertical scroll would step the wizard back.
  static const double flingVelocity = 400;

  @override
  State<OnboardingStepSwipe> createState() => _OnboardingStepSwipeState();
}

class _OnboardingStepSwipeState extends State<OnboardingStepSwipe> {
  double _travelled = 0;

  bool get _backIsRight => Directionality.of(context) != TextDirection.rtl;

  void _onStart(DragStartDetails _) => _travelled = 0;

  void _onUpdate(DragUpdateDetails details) {
    _travelled += details.primaryDelta ?? 0;
  }

  void _onEnd(DragEndDetails details) {
    final onBack = widget.onBack;
    if (onBack == null) return;

    final width = context.size?.width ?? 0;
    if (width <= 0) return;

    final sign = _backIsRight ? 1 : -1;
    final travelled = _travelled * sign;
    final velocity = details.velocity.pixelsPerSecond.dx * sign;

    final flung = velocity >= OnboardingStepSwipe.flingVelocity;
    final dragged =
        travelled >= width * OnboardingStepSwipe.commitFraction && velocity >= 0;
    if (!flung && !dragged) return;

    HapticFeedback.selectionClick();
    onBack();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      // deferToChild, not opaque: the screens' own controls are inside, and an
      // opaque box here would claim the taps that miss them.
      behavior: HitTestBehavior.deferToChild,
      onHorizontalDragStart: _onStart,
      onHorizontalDragUpdate: _onUpdate,
      onHorizontalDragEnd: _onEnd,
      child: widget.child,
    );
  }
}
