import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../theme/kallo_colors.dart';
import '../theme/kallo_motion.dart';
import 'sidebar/drawer_drag_target.dart';
import 'sidebar/nav_drawer.dart';

/// App shell for the primary surfaces.
///
/// The web mobile view has NO bottom tab bar (`components/app/mobile-nav.tsx`):
/// navigation is a hamburger (in [AppHeader]) that opens a LEFT slide-in
/// drawer. This scaffold reproduces that — a body hosting the active branch,
/// plus [NavDrawer] (88vw≤320px, dim black/50 scrim, tap-scrim / swipe-left to
/// close, swipe-right anywhere to open).
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

  /// A finger has landed on a drag that could open the drawer. Inflate it NOW,
  /// before it starts moving — the same reason [_open] defers its own forward()
  /// by a frame. Doing it on the first drag update instead put the SVG parse and
  /// the provider subscriptions inside a frame that was already animating the
  /// panel, which is the hitch this whole path exists to avoid.
  void _onDrawerDragDown() {
    if (!_drawerMounted) setState(() => _drawerMounted = true);
  }

  /// Drag driver: while the user pulls the panel in, advance the open
  /// animation 1:1 with the finger.
  ///
  /// A closed drawer ignores leftward travel. The full-width recognizer wins
  /// plenty of drags that were never aimed at it, and a drawer that inches out
  /// on a leftward flick over blank canvas reads as a glitch.
  void _onDrawerDragUpdate(double delta, double panelWidth) {
    if (_controller.value == 0 && delta <= 0) return;
    _controller.value = (_controller.value + delta / panelWidth).clamp(
      0.0,
      1.0,
    );
  }

  /// Drag release: fling/threshold decides whether it settles open.
  void _onDrawerDragEnd(double velocity) {
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
    final panelWidth =
        (MediaQuery.of(context).size.width * 0.88).clamp(0.0, 320.0).toDouble();

    return NavDrawerScope(
      open: _open,
      child: Scaffold(
        backgroundColor: KalloColors.surface,
        body: Stack(
          children: [
            // Swipe-to-open from anywhere on the page. It wraps the shell
            // rather than covering it, and that is the whole trick: hit-test
            // results run deepest-first, so a descendant recognizer enters the
            // gesture arena first and wins by default. Every nested horizontal
            // gesture therefore keeps working untouched — the dashboard day
            // pager, the logging week strip, a meal card's swipe-to-delete,
            // the Circle pill strip, the draggable FAB, the sliders. An
            // overlay (which is what the edge strip below is) would have won
            // those instead, which is why the gesture was pinned to 20px in
            // the first place. Nothing pushed ever sits under this: every
            // detail route goes on the root navigator, above the shell.
            //
            // All five branches stay alive in the indexedStack behind this, so
            // the scrim fading over them would otherwise repaint every one of
            // them on every frame of the slide.
            DrawerDragTarget(
              panelWidth: panelWidth,
              onDown: _onDrawerDragDown,
              onUpdate: _onDrawerDragUpdate,
              onEnd: _onDrawerDragEnd,
              child: RepaintBoundary(child: widget.navigationShell),
            ),
            // The edge still gets a guarantee. Over the one PageView or meal
            // card that legitimately wins the drag above, this strip sits ON
            // TOP and claims it back, so the drawer is never unreachable.
            // Sits below the drawer so once open, its own gestures take over.
            Positioned(
              left: 0,
              top: 0,
              bottom: 0,
              width: 20,
              child: DrawerDragTarget(
                panelWidth: panelWidth,
                onDown: _onDrawerDragDown,
                onUpdate: _onDrawerDragUpdate,
                onEnd: _onDrawerDragEnd,
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
