import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import 'swipe_back_detector.dart';

/// The app's page transition: Cupertino's slide, with a back drag that starts
/// anywhere on the page instead of inside iOS's 20pt edge strip.
///
/// Installed once via [kKalloPageTransitions] rather than per route. `MaterialPageRoute.buildTransitions` resolves the builder off the
/// theme, so every route in the app — and every route added later — inherits
/// this without a `pageBuilder` of its own. That is also why the four routes
/// that used to be `CupertinoPage` are now `MaterialPage`: a `CupertinoPage`
/// builds its own transition and never consults the theme.
///
/// [transitionDuration] is NOT optional to override. `MaterialPageRoute` reads
/// its duration off this builder too, so inheriting the 300ms default would
/// silently speed every push in the app up from Cupertino's 500ms.
///
/// A fullscreen dialog keeps the stock treatment — it slides up from the bottom
/// and has no back gesture in Cupertino either.
class KalloSwipeBackTransitionsBuilder extends PageTransitionsBuilder {
  const KalloSwipeBackTransitionsBuilder();

  @override
  Duration get transitionDuration =>
      CupertinoRouteTransitionMixin.kTransitionDuration;

  /// 350ms going BACK, against 500 going forward.
  ///
  /// Cupertino's own gesture controller does not let a released swipe finish
  /// at the route's push duration: `_CupertinoBackGestureController.dragEnd`
  /// retimes the settle to `_kDroppedSwipePageAnimationDuration` (350ms,
  /// `cupertino/route.dart`) before handing the pop to the navigator. This
  /// detector pops through the navigator directly — that is what lets the page
  /// leave from where the finger dropped it instead of snapping back on screen
  /// first — so nothing was retiming anything, and a drag released at 60%
  /// spent a full 500ms crawling through the last 40%. On device that read as
  /// "swiping left/right still feels really slow", and it is the whole of it.
  ///
  /// The route's [AnimationController] is `@protected`, so the per-gesture
  /// retime Cupertino does is not reachable from here; this is the public
  /// hook, and `MaterialRouteTransitionMixin` feeds it straight to the
  /// controller's `reverseDuration` (`material/page.dart`).
  ///
  /// It is BROADER than Cupertino's rule on purpose: a chevron tap now pops at
  /// 350 too, where stock iOS would take 500. One duration for "going back",
  /// however the user asked, is the more legible rule of the two — and the
  /// faster one is the one that matches the gesture.
  @override
  Duration get reverseTransitionDuration => const Duration(milliseconds: 350);

  @override
  DelegatedTransitionBuilder? get delegatedTransition =>
      CupertinoPageTransition.delegatedTransition;

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    if (route.fullscreenDialog) {
      return CupertinoRouteTransitionMixin.buildPageTransitions<T>(
        route,
        context,
        animation,
        secondaryAnimation,
        child,
      );
    }
    return CupertinoPageTransition(
      primaryRouteAnimation: animation,
      secondaryRouteAnimation: secondaryAnimation,
      // Linear while a finger owns the drag, so the page tracks the finger
      // rather than easing under it.
      linearTransition: route.popGestureInProgress,
      child: SwipeBackDetector<T>(route: route, child: child),
    );
  }
}

/// The app's `pageTransitionsTheme`, composed into [MaterialApp] by `app.dart`.
///
/// It lives HERE, beside the builder, rather than in `KalloTheme.light()`:
/// `lib/theme/` is the layer every widget imports for a spacing token, and a
/// theme that reached up into `shell/nav/` dragged the gesture stack in behind
/// it and left a `theme -> shell -> theme` cycle one edit away.
///
/// Registered for android as well as the Apple platforms on purpose: widget
/// tests run as android, so an iOS-only registration would make the gesture
/// untestable, and android already got Cupertino transitions on the routes
/// that used to be `CupertinoPage`.
const kKalloPageTransitions = PageTransitionsTheme(
  builders: <TargetPlatform, PageTransitionsBuilder>{
    TargetPlatform.iOS: KalloSwipeBackTransitionsBuilder(),
    TargetPlatform.macOS: KalloSwipeBackTransitionsBuilder(),
    TargetPlatform.android: KalloSwipeBackTransitionsBuilder(),
  },
);
