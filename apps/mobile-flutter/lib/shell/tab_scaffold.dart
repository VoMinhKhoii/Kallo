import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../theme/kallo_colors.dart';
import 'nav/nav_visibility.dart';
import 'nav/over_shell/log_page.dart';
import 'nav/pill_nav_bottom.dart';
import 'nav/pill_nav_column.dart';
import 'window/window_layout.dart';

/// App shell for the primary surfaces (native pass, 2026-08-31).
///
/// The web-parity hamburger + left drawer is retired — this is the sanctioned
/// divergence the redesign is built around. A floating pill carries the four
/// destinations plus the center "+" Add sheet; Settings pushes over the shell
/// from the dashboard avatar; the Log tab pushes the logging feed full-screen
/// (see nav/nav_actions.dart). This shell picks where the pill goes: standing
/// in a control column ([PillNavColumn]) or over the bottom edge
/// ([PillNavBottom]).
///
/// go_router's [StatefulNavigationShell] still backs the branches so each
/// destination keeps its state/scroll across switches. `extendBody` lets the
/// active branch draw under the floating bar while the scaffold rewrites the
/// body's `MediaQuery.padding.bottom` to clear it — scroll views that respect
/// their safe area lift above the pill for free.
///
/// The shell also owns the hide-on-scroll rule for the bar: reading DOWN a
/// long branch slides the pill away, the first upward flick (including the
/// pull-to-refresh overscroll) brings it back. The rule itself lives in
/// [NavVisibility]; the listener only forwards to it, and the bar keeps its
/// laid-out height either way, because that height IS the bottom inset every
/// branch scrolls against.
class TabScaffold extends ConsumerWidget {
  const TabScaffold({required this.navigationShell, super.key});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final layout = WindowLayout.of(context);
    return Scaffold(
      backgroundColor: KalloColors.surface,
      extendBody: true,
      // The branch always occupies this same slot, even while folding. Only
      // chrome moves: replacing its parent would discard branch scroll state.
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Beside the column a Log page no longer blocks what is beneath
          // it ([LogPage]), so the branch it covers leaves the semantics tree
          // and only the capsule stays reachable.
          ValueListenableBuilder<bool>(
            valueListenable: logOverShell,
            builder:
                (context, covered, child) => ExcludeSemantics(
                  excluding: covered && layout.hasControlColumn,
                  child: child,
                ),
            child: NotificationListener<UserScrollNotification>(
              onNotification:
                  (n) =>
                      layout.hasControlColumn
                          ? false
                          : ref
                              .read(navVisibilityProvider.notifier)
                              .applyScroll(n),
              child: navigationShell,
            ),
          ),
          if (layout.hasControlColumn)
            Positioned(
              top: 0,
              height: layout.size.height,
              left: layout.nearLeft ? 0 : null,
              right: layout.controlEdge == ControlEdge.right ? 0 : null,
              width: layout.columnWidth,
              // Scaffold consumes viewInsets in its body. Chrome still needs
              // the original keyboard signal and its uncompressed slot.
              child: MediaQuery(
                data: MediaQuery.of(context),
                child: PillNavColumn(navigationShell: navigationShell),
              ),
            ),
        ],
      ),
      bottomNavigationBar:
          layout.hasControlColumn
              ? null
              : PillNavBottom(navigationShell: navigationShell),
    );
  }
}
