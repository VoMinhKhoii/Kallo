import 'package:flutter/cupertino.dart';

import 'swipe_back_detector.dart';

/// The app's page transition: Cupertino's slide, with a back drag that starts
/// anywhere on the page instead of inside iOS's 20pt edge strip.
///
/// Installed once in [KalloTheme.light]'s `pageTransitionsTheme` rather than
/// per route. `MaterialPageRoute.buildTransitions` resolves the builder off the
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
