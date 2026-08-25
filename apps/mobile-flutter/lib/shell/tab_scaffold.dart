import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../theme/kallo_colors.dart';
import '../theme/kallo_motion.dart';
import 'sidebar/nav_drawer.dart';

/// App shell for the primary surfaces.
///
/// The web mobile view has NO bottom tab bar (`components/app/mobile-nav.tsx`):
/// navigation is a hamburger (in [AppHeader]) that opens a LEFT slide-in
/// drawer. This scaffold reproduces that — a body hosting the active branch,
/// plus [NavDrawer] (88vw≤320px, dim black/50 scrim, tap-scrim / swipe-left to
/// close, left-edge swipe to open).
///
/// go_router's [StatefulNavigationShell] still backs the branches so each
/// destination keeps its state/scroll across switches; only the bottom bar is
/// gone. [AppHeader]'s hamburger opens the drawer via [NavDrawerScope].
///
/// The drawer's TIMING is the app's own, not the web sheet's — see
/// [KalloMotion.drawerOpen] for why 500ms was dropped.
class TabScaffold extends StatefulWidget {
  const TabScaffold({required this.navigationShell, super.key});

  final StatefulNavigationShell navigationShell;

  @override
  State<TabScaffold> createState() => _TabScaffoldState();
}

class _TabScaffoldState extends State<TabScaffold>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: KalloMotion.drawerOpen,
    reverseDuration: KalloMotion.drawerClose,
  );

  /// Whether the drawer's subtree exists yet. It is inflated one frame BEFORE
  /// the first slide rather than during it: building the sidebar costs an SVG
  /// parse and two provider subscriptions, and paying that inside the opening
  /// frame is what made the drawer hitch as it left the edge. Once true it
  /// stays true — a built drawer is free to keep.
  bool _drawerMounted = false;

  void _open() {
    // Tactile cue only when actually opening from rest — not on a repeat tap
    // while already open, nor on every frame of an edge-swipe.
    if (_controller.value == 0) HapticFeedback.lightImpact();
    if (_drawerMounted) {
      _controller.forward();
      return;
    }
    setState(() => _drawerMounted = true);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _controller.forward();
    });
  }

  void _close() => _controller.reverse();

  /// Edge-swipe driver: while the user drags in from the left edge, advance the
  /// open animation 1:1 with the finger.
  void _onEdgeDragUpdate(double delta, double panelWidth) {
    if (!_drawerMounted) setState(() => _drawerMounted = true);
    _controller.value = (_controller.value + delta / panelWidth).clamp(0.0, 1.0);
  }

  /// Edge-swipe release: fling/threshold decides whether it settles open.
  void _onEdgeDragEnd(double velocity) {
    final opening =
        velocity > 200 || (velocity >= -200 && _controller.value > 0.4);
    if (opening) {
      HapticFeedback.lightImpact();
      _controller.forward();
    } else {
      _controller.reverse();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Mirror the panel width the drawer itself uses, so an edge-drag maps the
    // finger to the panel travel 1:1.
    final panelWidth = (MediaQuery.of(context).size.width * 0.88)
        .clamp(0.0, 320.0)
        .toDouble();

    return NavDrawerScope(
      open: _open,
      child: Scaffold(
        backgroundColor: KalloColors.surface,
        body: Stack(
          children: [
            // All five branches stay alive in the indexedStack behind this, so
            // the scrim fading over them would otherwise repaint every one of
            // them on every frame of the slide.
            RepaintBoundary(child: widget.navigationShell),
            // Left-edge swipe-to-open zone. A narrow strip (matching the native
            // Android drawer affordance) so it never steals horizontal swipes
            // from page content. Only claims horizontal drags — vertical scroll
            // in the strip still reaches the list beneath. Sits below the
            // drawer so once open, the drawer's own gestures take over.
            Positioned(
              left: 0,
              top: 0,
              bottom: 0,
              width: 20,
              child: GestureDetector(
                behavior: HitTestBehavior.translucent,
                onHorizontalDragUpdate:
                    (d) => _onEdgeDragUpdate(d.primaryDelta ?? 0, panelWidth),
                onHorizontalDragEnd:
                    (d) => _onEdgeDragEnd(d.primaryVelocity ?? 0),
                // An interrupted swipe (recognizer loses the arena) never fires
                // dragEnd — settle from rest so the drawer can't stick halfway.
                onHorizontalDragCancel: () => _onEdgeDragEnd(0),
              ),
            ),
            NavDrawer(
              controller: _controller,
              mounted: _drawerMounted,
              onClose: _close,
            ),
          ],
        ),
      ),
    );
  }
}

/// Exposes the drawer-open callback down the tree so [AppHeader]'s hamburger
/// can trigger it without any feature screen passing a handler.
class NavDrawerScope extends InheritedWidget {
  const NavDrawerScope({required this.open, required super.child, super.key});

  final VoidCallback open;

  static NavDrawerScope? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<NavDrawerScope>();

  @override
  bool updateShouldNotify(NavDrawerScope oldWidget) => open != oldWidget.open;
}
