import 'package:flutter/widgets.dart';

import 'swipe_back_recognizer.dart';

/// Drives a route's pop animation from a horizontal drag started ANYWHERE on
/// the page, not just inside iOS's 20pt edge strip.
///
/// **Why this is an ancestor of the page and not a sibling above it.** Flutter's
/// own `_CupertinoBackGestureDetector` puts its `Listener` in a `Stack` ABOVE
/// the page, which is what makes it win the arena against everything the page
/// contains. That is harmless while the strip is 20pt wide and disastrous at
/// full width: it would eat the logging timeline's week paging, the portion and
/// pace rulers, and every swipe-to-remove row. Wrapping the page instead puts
/// this recognizer LATER in the hit-test path than anything inside it, so a
/// horizontal scrollable under the finger wins by construction — no exclusion
/// list to maintain, and a horizontal widget added to any screen later is
/// protected the day it lands.
///
/// Everything it touches is public API as of Flutter 3.44: [ModalRoute
/// .popGestureEnabled], [PredictiveBackRoute.handleStartBackGesture] and
/// friends, and `route.animation` (which IS the route's controller view, so it
/// reads the same value the drag writes). Reading the same `popGestureEnabled`
/// getter stock Cupertino reads is what keeps the nested-navigator contract in
/// `features/settings/widgets/chrome/settings_navigator.dart` working: while
/// that route reports `canPop: false`, `popDisposition` is `doNotPop`, this
/// gesture never arms, and the inner navigator owns the drag.
class SwipeBackDetector<T> extends StatefulWidget {
  const SwipeBackDetector({
    super.key,
    required this.route,
    required this.child,
  });

  final PageRoute<T> route;
  final Widget child;

  /// Screen widths per second past which the release is a fling and the
  /// direction of travel decides, rather than how far the page got.
  /// Cupertino's own value.
  static const double minFlingVelocity = 1;

  @override
  State<SwipeBackDetector<T>> createState() => _SwipeBackDetectorState<T>();
}

class _SwipeBackDetectorState<T> extends State<SwipeBackDetector<T>> {
  SwipeBackDragRecognizer? _recognizer;
  bool _dragging = false;

  @override
  void initState() {
    super.initState();
    _recognizer = SwipeBackDragRecognizer(
      debugOwner: this,
      isRightToLeft: () =>
          mounted && Directionality.of(context) == TextDirection.rtl,
    )
      ..onStart = _handleDragStart
      ..onUpdate = _handleDragUpdate
      ..onEnd = _handleDragEnd
      ..onCancel = _handleDragCancel;
  }

  @override
  void dispose() {
    _recognizer?.dispose();
    _recognizer = null;
    super.dispose();
  }

  /// Gated at pointer-down rather than at drag-start: a recognizer that enters
  /// the arena and then bails has already taken the pointer away from whatever
  /// else wanted it.
  void _handlePointerDown(PointerDownEvent event) {
    final route = widget.route;
    if (!route.popGestureEnabled) return;
    if (!route.isCurrent) return;
    // `popGestureEnabled` stopped checking this in 3.44, and without it a
    // second finger can start a second drag on a page already leaving.
    final navigator = route.navigator;
    if (navigator == null || navigator.userGestureInProgress) return;
    _recognizer?.addPointer(event);
  }

  double get _width {
    final width = context.size?.width ?? 0;
    return width > 0 ? width : MediaQuery.sizeOf(context).width;
  }

  /// The drag's travel as the animation reads it: 1.0 is fully on screen, 0.0
  /// is dismissed, and "back" is whichever way the text runs from.
  double _logical(double value) =>
      Directionality.of(context) == TextDirection.rtl ? -value : value;

  void _handleDragStart(DragStartDetails details) {
    final route = widget.route;
    if (!route.isCurrent) return;
    _dragging = true;
    route.handleStartBackGesture(progress: route.animation?.value ?? 1);
  }

  void _handleDragUpdate(DragUpdateDetails details) {
    if (!_dragging) return;
    final route = widget.route;
    final width = _width;
    if (width <= 0) return;
    final delta = _logical((details.primaryDelta ?? 0) / width);
    final next = ((route.animation?.value ?? 1) - delta).clamp(0.0, 1.0);
    route.handleUpdateBackGestureProgress(progress: next);
  }

  void _handleDragCancel() {
    if (!_dragging) return;
    _dragging = false;
    widget.route.handleCancelBackGesture();
  }

  void _handleDragEnd(DragEndDetails details) {
    if (!_dragging) return;
    _dragging = false;
    final route = widget.route;
    final width = _width;
    final velocity = width <= 0
        ? 0.0
        : _logical(details.velocity.pixelsPerSecond.dx / width);

    final bool animateForward;
    if (!route.isCurrent) {
      // Something popped this route out from under the drag; where it goes now
      // depends only on whether it is still in the stack.
      animateForward = route.isActive;
    } else if (velocity.abs() >= SwipeBackDetector.minFlingVelocity) {
      animateForward = velocity <= 0;
    } else {
      animateForward = (route.animation?.value ?? 1) > 0.5;
    }

    if (animateForward) {
      route.handleCancelBackGesture();
      return;
    }
    _commit(route);
  }

  /// Pops through the navigator directly instead of [PredictiveBackRoute
  /// .handleCommitBackGesture], which reverses the controller `from:
  /// upperBound` — snapping a half-dragged page back to fully on-screen for a
  /// frame before it slides out. Popping lets the route reverse from where the
  /// finger left it, which is the whole point of an interactive drag.
  void _commit(PageRoute<T> route) {
    final navigator = route.navigator;
    if (navigator == null) return;
    if (route.isCurrent) navigator.pop();

    final animation = route.animation;
    if (animation != null && animation.isAnimating) {
      // Hold `userGestureInProgress` until the page has left, so the transition
      // stays linear instead of switching curve mid-flight.
      late final AnimationStatusListener onSettled;
      onSettled = (AnimationStatus status) {
        if (status.isAnimating) return;
        animation.removeStatusListener(onSettled);
        navigator.didStopUserGesture();
      };
      animation.addStatusListener(onSettled);
    } else {
      navigator.didStopUserGesture();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      onPointerDown: _handlePointerDown,
      behavior: HitTestBehavior.translucent,
      child: widget.child,
    );
  }
}
