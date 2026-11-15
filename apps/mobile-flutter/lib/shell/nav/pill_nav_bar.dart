import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../theme/calm_tokens.dart';
import '../window/window_layout.dart';
import '../window/window_regions.dart';
import 'add_sheet.dart';
import 'nav_actions.dart';
import 'nav_visibility.dart';
import 'pill_nav_add_button.dart';
import 'pill_nav_item.dart';
import 'pill_nav_surface.dart';
import 'pill_nav_veil.dart';

/// The floating pill tab bar (native pass, 2026-08-31): a 72pt-tall white
/// capsule with the two-layer nav shadow, four tabs (Today / Log / Nutrition
/// / Circle) around a 52pt brand-sweep "+" that opens the Add sheet.
///
/// On a compact phone it spans the screen less [kNavInset] either side — a
/// floating pill with fully-rounded ends, rather than a fixed 358pt island
/// with bunched targets. Wide windows cap it at 420pt; a control column turns
/// it into a 56pt vertical capsule with a 44pt Add disc.
///
/// Today, Nutrition and Circle switch shell branches; Log PUSHES the logging
/// feed full-screen over the shell (see [goToLogging]) — the composer owns
/// that screen's bottom edge, and swipe-back returns here. The bar slides
/// away while the keyboard is up. The bottom bar also hides on a downward
/// scroll, returning on the first upward flick — see NavVisibility and
/// PillNavVeil. The side capsule stays visible while scrolling.
///
/// CupertinoTabBar cannot occupy the asymmetric safe-area column. Retire this
/// custom placement when it can, preserving the Log push and Add sheet actions.
class PillNavBar extends ConsumerWidget {
  const PillNavBar({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  void _goBranch(WidgetRef ref, int index) {
    // Switching tabs always brings the bar back: the destination scrolls from
    // its own offset and the user has just told us they want the nav.
    ref.read(navVisibilityProvider.notifier).reveal();
    navigationShell.goBranch(
      index,
      // Re-tapping the active tab pops that branch to its root (the standard
      // iOS behavior).
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final layout = WindowLayout.of(context);
    final vertical = layout.hasControlColumn;
    final axis = vertical ? Axis.vertical : Axis.horizontal;
    final keyboardUp = MediaQuery.viewInsetsOf(context).bottom > 0;
    final bottomInset = layout.viewPadding.bottom;
    // Branch indices after the shell reorder: dashboard, nutrition, circle.
    final current = navigationShell.currentIndex;
    final capsule = PillNavSurface(
      axis: axis,
      child: Flex(
        direction: axis,
        mainAxisSize: vertical ? MainAxisSize.min : MainAxisSize.max,
        children: [
          PillNavItem(
            axis: axis,
            icon: LucideIcons.house300,
            activeIcon: LucideIcons.house400,
            label: tr('app.nav.today'),
            active: current == 0,
            onTap: () => _goBranch(ref, 0),
          ),
          PillNavItem(
            axis: axis,
            icon: LucideIcons.pencilLine300,
            label: tr('app.nav.log'),
            active: false,
            onTap: () => goToLogging(context),
          ),
          PillNavAddButton(
            axis: axis,
            onTap: () {
              HapticFeedback.lightImpact();
              // The sheet lands over the bar, so leave the bar showing
              // underneath it rather than half-slid away.
              ref.read(navVisibilityProvider.notifier).reveal();
              showAddSheet(context, ref);
            },
          ),
          PillNavItem(
            axis: axis,
            icon: LucideIcons.apple300,
            activeIcon: LucideIcons.apple400,
            label: tr('app.nav.nutrition'),
            active: current == 1,
            onTap: () => _goBranch(ref, 1),
          ),
          PillNavItem(
            axis: axis,
            icon: LucideIcons.users300,
            activeIcon: LucideIcons.users400,
            label: tr('app.nav.circle'),
            active: current == 2,
            onTap: () => _goBranch(ref, 2),
            showInviteBadge: true,
          ),
        ],
      ),
    );
    // Out of the way while typing; the bottom bar also hides while reading
    // down a long branch. Both hide the same way: translation, never resizing.
    Widget veil(Widget child) => PillNavVeil(
      hidden: keyboardUp || (!vertical && !ref.watch(navVisibilityProvider)),
      direction: switch (layout.controlEdge) {
        ControlEdge.left => const Offset(-1, 0),
        ControlEdge.right => const Offset(1, 0),
        ControlEdge.bottom => const Offset(0, 1),
      },
      child: child,
    );
    if (vertical) {
      return Padding(
        padding: EdgeInsets.only(
          bottom: layout.compactHeight ? 0 : bottomInset + 8,
        ),
        child: Transform.translate(
          offset: Offset(
            layout.controlEdge == ControlEdge.right
                ? 36 - layout.columnWidth / 2
                : layout.columnWidth / 2 - 36,
            0,
          ),
          child: Align(
            alignment:
                layout.compactHeight
                    ? Alignment.center
                    : Alignment.bottomCenter,
            child: veil(capsule),
          ),
        ),
      );
    }
    // Keep this wrapper's height even when hidden: Scaffold publishes its
    // measured height as the branch's bottom scroll clearance.
    final far = WindowRegions(layout).far;
    return veil(
      Padding(
        padding: EdgeInsets.fromLTRB(
          layout.twoPane ? far.left + 12 : kNavInset,
          12,
          layout.twoPane ? layout.size.width - far.right + 12 : kNavInset,
          bottomInset > 0 ? bottomInset : 24,
        ),
        // heightFactor pins the bar to the pill's own height: a bare Center
        // EXPANDS to the Scaffold's bounded bottomNavigationBar constraints,
        // claiming the full screen (pill mid-screen, every extendBody tab
        // SafeArea'd to zero height — the 2026-08-31 TestFlight regression).
        child: Center(
          heightFactor: 1,
          child: ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: layout.regularWidth ? 420 : double.infinity,
            ),
            child: capsule,
          ),
        ),
      ),
    );
  }
}
