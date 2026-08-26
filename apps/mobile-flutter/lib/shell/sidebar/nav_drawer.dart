import 'package:flutter/material.dart';

import '../../theme/kallo_colors.dart';
import '../../theme/kallo_motion.dart';
import 'sidebar.dart';

/// The left slide-in panel and its scrim, driven by [controller]
/// (0 = closed, 1 = open).
///
/// Three things here are deliberate, and each replaced something that made the
/// slide feel worse than it looked:
///
/// 1. **[Sidebar] is built once**, handed through `AnimatedBuilder`'s `child`
///    slot. It was inside the builder, so every frame of the slide rebuilt a
///    `ConsumerWidget` that does two `ref.watch`es, two `GoRouterState.of`
///    lookups, an SVG wordmark parse and six `AnimatedContainer`s. Thirty-odd
///    times per open, for a subtree that never changes while it travels.
///
/// 2. **It slides by transform, not by layout.** The panel was positioned at
///    `left: -width * (1 - t)` — a direct port of the web sheet's CSS, but in
///    Flutter that re-lays-out the whole panel every frame instead of
///    re-offsetting a layer that is already painted. [SlideTransition] moves it
///    without touching layout.
///
/// 3. **It stays mounted once opened.** The panel used to vanish at t == 0, so
///    the first frame of every open paid for the entire inflate — including
///    that SVG parse — while the animation was already running. That is the
///    hitch at the start of the slide. After the first open it costs nothing to
///    keep, so it is kept.
class NavDrawer extends StatelessWidget {
  const NavDrawer({
    super.key,
    required this.controller,
    required this.mounted,
    required this.onClose,
  });

  final AnimationController controller;

  /// False until the drawer has been opened once. See (3) above.
  final bool mounted;

  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    if (!mounted) return const SizedBox.shrink();

    // w-[88vw] max-w-[320px] (web mobile-nav.tsx).
    final panelWidth = (MediaQuery.of(context).size.width * 0.88)
        .clamp(0.0, 320.0)
        .toDouble();
    final eased = CurvedAnimation(parent: controller, curve: KalloEase.drawer);

    return Stack(
      children: [
        // Scrim — black @ 50%, fading with the slide; tap to close. It gets its
        // own builder because it genuinely needs the value every frame, and its
        // own subtree is one ColoredBox.
        Positioned.fill(
          child: AnimatedBuilder(
            animation: eased,
            builder: (context, _) {
              final t = eased.value;
              // Inert when fully closed, so a mounted-but-hidden drawer never
              // swallows a tap meant for the screen behind it.
              return IgnorePointer(
                ignoring: t == 0,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: onClose,
                  child: ColoredBox(color: Color.fromRGBO(0, 0, 0, 0.5 * t)),
                ),
              );
            },
          ),
        ),
        Positioned(
          top: 0,
          bottom: 0,
          left: 0,
          width: panelWidth,
          child: SlideTransition(
            position: Tween<Offset>(
              begin: const Offset(-1, 0),
              end: Offset.zero,
            ).animate(eased),
            child: _Panel(
              controller: controller,
              panelWidth: panelWidth,
              onClose: onClose,
            ),
          ),
        ),
      ],
    );
  }
}

/// The panel itself: the swipe-to-dismiss gesture, the surface, and the
/// sidebar's content — none of which changes while the drawer travels, so all
/// of it is built once and carried through the transition.
class _Panel extends StatelessWidget {
  const _Panel({
    required this.controller,
    required this.panelWidth,
    required this.onClose,
  });

  final AnimationController controller;
  final double panelWidth;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onHorizontalDragUpdate:
          (details) =>
              controller.value += (details.primaryDelta ?? 0) / panelWidth,
      onHorizontalDragEnd: (details) {
        final velocity = details.primaryVelocity ?? 0;
        if (velocity < -200 || controller.value < 0.5) {
          onClose();
        } else {
          controller.forward();
        }
      },
      // The app content behind this is an indexedStack holding all five tabs
      // alive. Without a boundary, the scrim recolouring on top of it dirties
      // that entire tree once per frame.
      child: RepaintBoundary(
        child: DecoratedBox(
          decoration: const BoxDecoration(
            color: KalloColors.surface,
            border: Border(
              right: BorderSide(color: KalloColors.borderSoft, width: 1),
            ),
          ),
          child: Sidebar(onClose: onClose),
        ),
      ),
    );
  }
}
