import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../theme/nham_colors.dart';
import 'sidebar.dart';

/// App shell for the primary surfaces.
///
/// The web mobile view has NO bottom tab bar (`components/app/mobile-nav.tsx`):
/// navigation is a hamburger (in [AppHeader]) that opens a LEFT slide-in Sheet
/// drawer. This scaffold reproduces that — a cream body hosting the active
/// branch, plus a custom left drawer ([_NavDrawer]) matching the shadcn Sheet
/// behavior (88vw≤320px, dim black/50 scrim, asymmetric 500ms-open / 300ms-close
/// ease-in-out slide, tap-scrim / swipe-left to close).
///
/// go_router's [StatefulNavigationShell] still backs the branches so each
/// destination keeps its state/scroll across switches; only the bottom bar is
/// gone. [AppHeader]'s hamburger opens the drawer via [NavDrawerScope].
class TabScaffold extends StatefulWidget {
  const TabScaffold({required this.navigationShell, super.key});

  final StatefulNavigationShell navigationShell;

  @override
  State<TabScaffold> createState() => _TabScaffoldState();
}

class _TabScaffoldState extends State<TabScaffold>
    with SingleTickerProviderStateMixin {
  // Sheet: open over 500ms, close over 300ms, ease-in-out (sheet.tsx:63).
  static const Duration _openDuration = Duration(milliseconds: 500);
  static const Duration _closeDuration = Duration(milliseconds: 300);

  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: _openDuration,
    reverseDuration: _closeDuration,
  );

  void _open() {
    // Tactile cue only when actually opening from rest — not on a repeat tap
    // while already open, nor on every frame of an edge-swipe.
    if (_controller.value == 0) HapticFeedback.lightImpact();
    _controller.forward();
  }

  void _close() {
    _controller.reverse();
  }

  /// Edge-swipe driver: while the user drags in from the left edge, advance the
  /// open animation 1:1 with the finger.
  void _onEdgeDragUpdate(double delta, double panelWidth) {
    _controller.value =
        (_controller.value + delta / panelWidth).clamp(0.0, 1.0);
  }

  /// Edge-swipe release: fling/threshold decides whether it settles open.
  void _onEdgeDragEnd(double velocity) {
    final opening = velocity > 200 || (velocity >= -200 && _controller.value > 0.4);
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
    final media = MediaQuery.of(context);
    // Mirror the panel width the drawer itself uses, so an edge-drag maps the
    // finger to the panel travel 1:1.
    final panelWidth = (media.size.width * 0.88).clamp(0.0, 320.0).toDouble();

    return NavDrawerScope(
      open: _open,
      child: Scaffold(
        backgroundColor: NhamColors.surface,
        body: Stack(
          children: [
            widget.navigationShell,
            // Left-edge swipe-to-open zone. A narrow strip (matching the native
            // Android drawer affordance) so it never steals horizontal swipes
            // from page content. Only claims horizontal drags — vertical scroll
            // in the strip still reaches the list beneath. Sits below the drawer
            // so once open, the drawer's own scrim/panel gestures take over.
            Positioned(
              left: 0,
              top: 0,
              bottom: 0,
              width: 20,
              child: GestureDetector(
                behavior: HitTestBehavior.translucent,
                onHorizontalDragUpdate: (d) =>
                    _onEdgeDragUpdate(d.primaryDelta ?? 0, panelWidth),
                onHorizontalDragEnd: (d) =>
                    _onEdgeDragEnd(d.primaryVelocity ?? 0),
                // An interrupted swipe (recognizer loses the arena) never fires
                // dragEnd — settle from rest so the drawer can't stick halfway.
                onHorizontalDragCancel: () => _onEdgeDragEnd(0),
              ),
            ),
            _NavDrawer(controller: _controller, onClose: _close),
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

/// The left slide-in panel + scrim, driven by [controller] (0 = closed,
/// 1 = open).
class _NavDrawer extends StatelessWidget {
  const _NavDrawer({required this.controller, required this.onClose});

  final AnimationController controller;
  final VoidCallback onClose;

  // Sheet easing — `transition ease-in-out` (sheet.tsx:63).
  static const Curve _curve = Curves.easeInOut;

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    // w-[88vw] max-w-[320px] (mobile-nav.tsx:111).
    final panelWidth = (media.size.width * 0.88).clamp(0.0, 320.0).toDouble();

    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        final t = _curve.transform(controller.value);
        if (t == 0) return const SizedBox.shrink();

        return Stack(
          children: [
            // Scrim — black @ 50%, fades with the slide; tap to close.
            Positioned.fill(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: onClose,
                child: ColoredBox(color: Color.fromRGBO(0, 0, 0, 0.5 * t)),
              ),
            ),
            // Panel — full height, slides in from the left edge.
            Positioned(
              top: 0,
              bottom: 0,
              left: -panelWidth * (1 - t),
              width: panelWidth,
              // Swipe-left to dismiss.
              child: GestureDetector(
                onHorizontalDragUpdate: (details) {
                  controller.value += details.primaryDelta! / panelWidth;
                },
                onHorizontalDragEnd: (details) {
                  final v = details.primaryVelocity ?? 0;
                  if (v < -200 || controller.value < 0.5) {
                    onClose();
                  } else {
                    controller.forward();
                  }
                },
                child: DecoratedBox(
                  decoration: const BoxDecoration(
                    color: NhamColors.surface,
                    border: Border(
                      right: BorderSide(
                        color: NhamColors.borderSoft, // border @ 60%
                        width: 1,
                      ),
                    ),
                  ),
                  child: Sidebar(onClose: onClose),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
