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
