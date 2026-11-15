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

/// One set of targets for the floating bottom pill and the side capsule.
///
/// Cupertino's tab bar cannot occupy the system's asymmetric safe-area
/// column. Retire this custom placement when it can, preserving the brand
/// capsule's surfaces and the Log push / Add sheet actions.
class PillNavBar extends ConsumerWidget {
  const PillNavBar({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  void _goBranch(WidgetRef ref, int index) {
    ref.read(navVisibilityProvider.notifier).reveal();
    navigationShell.goBranch(
      index,
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
