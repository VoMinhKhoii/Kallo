import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'add_sheet.dart';
import 'nav_actions.dart';
import 'nav_visibility.dart';
import 'pill_nav_add_button.dart';
import 'pill_nav_item.dart';
import 'pill_nav_surface.dart';

/// The floating pill tab bar (native pass, 2026-08-31): a 72pt-tall white
/// capsule with the two-layer nav shadow, four tabs (Today / Log / Nutrition
/// / Circle) around a 52pt brand-sweep "+" that opens the Add sheet.
///
/// This is the capsule alone, laid along [axis]. Where it sits is the
/// placement's business: [PillNavBottom] floats it over the bottom edge, and
/// [PillNavColumn] stands it up in a control column as a 56pt vertical
/// capsule with a 44pt Add disc. The shell mounts one or the other.
///
/// Today, Nutrition and Circle switch shell branches; Log PUSHES the logging
/// feed full-screen over the shell (see [goToLogging]) — the composer owns
/// that screen's bottom edge, and swipe-back returns here.
///
/// CupertinoTabBar cannot occupy the asymmetric safe-area column. Retire this
/// custom placement when it can, preserving the Log push and Add sheet actions.
class PillNavCapsule extends ConsumerWidget {
  const PillNavCapsule({
    super.key,
    required this.navigationShell,
    required this.axis,
  });

  final StatefulNavigationShell navigationShell;
  final Axis axis;

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
    // Branch indices after the shell reorder: dashboard, nutrition, circle.
    final current = navigationShell.currentIndex;
    return PillNavSurface(
      axis: axis,
      child: Flex(
        direction: axis,
        mainAxisSize:
            axis == Axis.vertical ? MainAxisSize.min : MainAxisSize.max,
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
  }
}
