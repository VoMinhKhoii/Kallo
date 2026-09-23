import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';

import 'analytics.dart';

/// Send one screen view per route change, named by the matched route PATTERN.
///
/// A location like `/circle/invite/abc123` carries an invite slug (a
/// capability) and `/circle/<shareId>` a shared-meal id; the pattern
/// (`/circle/invite/:slug`) tells us which screen without storing whose.
/// Listening on the router delegate covers every navigator — including the
/// tab branches under the `StatefulShellRoute`, which a root
/// `NavigatorObserver` never sees.
///
/// Returns the disposer.
VoidCallback trackScreens(GoRouter router, Analytics analytics) {
  if (!analytics.enabled) return () {};
  String? last;
  void onChange() {
    final pattern = screenPattern(router.routerDelegate.currentConfiguration);
    if (pattern == null || pattern == last) return;
    last = pattern;
    analytics.screen(pattern);
  }

  router.routerDelegate.addListener(onChange);
  return () => router.routerDelegate.removeListener(onChange);
}

/// The route pattern of [matches], or null while nothing has matched yet.
@visibleForTesting
String? screenPattern(RouteMatchList matches) {
  if (matches.isEmpty) return null;
  final pattern = matches.fullPath;
  return pattern.isEmpty ? null : pattern;
}
