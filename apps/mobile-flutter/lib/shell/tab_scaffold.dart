import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../theme/kallo_colors.dart';
import 'nav/nav_visibility.dart';
import 'nav/pill_nav_bar.dart';

/// App shell for the primary surfaces (native pass, 2026-08-31).
///
/// The web-parity hamburger + left drawer is retired — this is the sanctioned
/// divergence the redesign is built around. A floating [PillNavBar] carries
/// the four destinations plus the center "+" Add sheet; Settings pushes over
/// the shell from the dashboard avatar; the Log tab pushes the logging feed
/// full-screen (see nav/nav_actions.dart).
///
/// go_router's [StatefulNavigationShell] still backs the branches so each
/// destination keeps its state/scroll across switches. `extendBody` lets the
/// active branch draw under the floating bar while the scaffold rewrites the
/// body's `MediaQuery.padding.bottom` to clear it — scroll views that respect
/// their safe area lift above the pill for free.
///
/// The shell also owns the hide-on-scroll rule for the bar: reading DOWN a
/// long branch slides the pill away, the first upward flick (including the
/// pull-to-refresh overscroll) brings it back. The listener writes
/// [navHiddenProvider] only — the bar keeps its laid-out height either way,
/// because that height IS the bottom inset every branch scrolls against.
class TabScaffold extends ConsumerWidget {
  const TabScaffold({required this.navigationShell, super.key});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: KalloColors.surface,
      extendBody: true,
      body: NotificationListener<UserScrollNotification>(
        onNotification: (n) => _onUserScroll(ref, n),
        child: navigationShell,
      ),
      bottomNavigationBar: PillNavBar(navigationShell: navigationShell),
    );
  }

  /// A page with barely more content than the viewport must never hide the
  /// nav: the few points of travel it has would trade the whole bar for a
  /// glimpse of one more row, and there would be nothing left to scroll back
  /// up through to get it returned.
  static const double _minScrollToHide = 120;

  bool _onUserScroll(WidgetRef ref, UserScrollNotification n) {
    // Depth 0 only — an inner horizontal strip or a sheet's own list is not
    // the branch scrolling.
    if (n.depth != 0 || n.metrics.axis != Axis.vertical) return false;

    final bool? hide = switch (n.direction) {
      _ when n.metrics.maxScrollExtent < _minScrollToHide => false,
      ScrollDirection.reverse => true,
      ScrollDirection.forward => false,
      // `idle` ends a gesture without expressing an intent — leave the bar
      // wherever the drag left it.
      ScrollDirection.idle => null,
    };
    if (hide != null && ref.read(navHiddenProvider) != hide) {
      ref.read(navHiddenProvider.notifier).state = hide;
    }
    return false;
  }
}
