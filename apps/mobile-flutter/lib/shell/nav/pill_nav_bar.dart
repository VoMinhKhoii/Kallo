import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../theme/calm_tokens.dart';
import '../../theme/kallo_colors.dart';
import '../../theme/kallo_theme.dart';
import 'add_sheet.dart';
import 'nav_actions.dart';
import 'nav_visibility.dart';
import 'pill_nav_item.dart';
import 'pill_nav_veil.dart';

/// The floating pill tab bar (native pass, 2026-08-31): a 72pt-tall white
/// capsule with the two-layer nav shadow, four tabs (Today / Log / Nutrition
/// / Circle) around a 52pt beige "+" that opens the Add sheet.
///
/// It spans the screen less [kNavInset] either side — still a floating pill
/// with fully-rounded ends and its shadow, just no longer a fixed 358pt island
/// with its targets bunched in the middle.
///
/// Today, Nutrition and Circle switch shell branches; Log PUSHES the logging
/// feed full-screen over the shell (see [goToLogging]) — the composer owns
/// that screen's bottom edge, and swipe-back returns here. The bar slides
/// away while the keyboard is up, and while the user scrolls DOWN a long
/// branch (revealed again on the first upward flick — see [NavVisibility]
/// and [PillNavVeil]).
class PillNavBar extends ConsumerWidget {
  const PillNavBar({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  // Branch indices after the shell reorder: dashboard, nutrition, circle,
  // admin (admin stays off-bar).
  static const int _dashboardBranch = 0;
  static const int _nutritionBranch = 1;
  static const int _circleBranch = 2;

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
    final keyboardUp = MediaQuery.viewInsetsOf(context).bottom > 0;
    final bottomInset = MediaQuery.viewPaddingOf(context).bottom;
    final current = navigationShell.currentIndex;

    final bar = Padding(
      padding: EdgeInsets.fromLTRB(
        kNavInset,
        KalloSpacing.sp3,
        kNavInset,
        bottomInset > 0 ? bottomInset : KalloSpacing.sp6,
      ),
      // heightFactor pins the bar to the pill's own height: a bare Center
      // EXPANDS to the Scaffold's bounded bottomNavigationBar constraints,
      // claiming the full screen (pill mid-screen, every extendBody tab
      // SafeArea'd to zero height — the 2026-08-31 TestFlight regression).
      child: Center(
        heightFactor: 1,
        child: Container(
          // No max width: the capsule takes everything [kNavInset] leaves it,
          // so it is derived from the screen rather than pinned to one phone.
          // Under Center's loose constraints `infinity` resolves to exactly
          // that padded width.
          width: double.infinity,
          height: kNavHeight,
          padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp3_5),
          decoration: BoxDecoration(
            color: kCardSurface,
            borderRadius: BorderRadius.circular(kNavRadius),
            boxShadow: kNavShadows,
          ),
          child: Row(
            children: [
              PillNavItem(
                icon: LucideIcons.house300,
                activeIcon: LucideIcons.house400,
                label: tr('app.nav.today'),
                active: current == _dashboardBranch,
                onTap: () => _goBranch(ref, _dashboardBranch),
              ),
              PillNavItem(
                icon: LucideIcons.pencilLine300,
                label: tr('app.nav.log'),
                active: false,
                onTap: () => goToLogging(context),
              ),
              _AddButton(onTap: () {
                HapticFeedback.lightImpact();
                // The sheet lands over the bar, so leave the bar showing
                // underneath it rather than half-slid away.
                ref.read(navVisibilityProvider.notifier).reveal();
                showAddSheet(context, ref);
              }),
              PillNavItem(
                icon: LucideIcons.apple300,
                activeIcon: LucideIcons.apple400,
                label: tr('app.nav.nutrition'),
                active: current == _nutritionBranch,
                onTap: () => _goBranch(ref, _nutritionBranch),
              ),
              PillNavItem(
                icon: LucideIcons.users300,
                activeIcon: LucideIcons.users400,
                label: tr('app.nav.circle'),
                active: current == _circleBranch,
                onTap: () => _goBranch(ref, _circleBranch),
                showInviteBadge: true,
              ),
            ],
          ),
        ),
      ),
    );

    // Out of the way while typing (the composer owns the bottom edge) and
    // while the user reads DOWN a long branch. Both hide the SAME way: the
    // veil translates the bar, never resizes it.
    return PillNavVeil(
      hidden: keyboardUp || !ref.watch(navVisibilityProvider),
      child: bar,
    );
  }
}

/// The 52pt center action: a beige circle with an ink plus (the button
/// system's in-app primary), the one piece of nav chrome with its own
/// shadow.
class _AddButton extends StatelessWidget {
  const _AddButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: tr('app.nav.add'),
      excludeSemantics: true,
      onTap: onTap,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: SizedBox(
          width: 64,
          height: kNavHeight,
          child: Center(
            child: Container(
              width: kNavAddSize,
              height: kNavAddSize,
              decoration: const BoxDecoration(
                color: KalloColors.btnPrimarySoft,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: Color(0x24141413),
                    blurRadius: 12,
                    offset: Offset(0, 4),
                  ),
                ],
              ),
              child: const Icon(
                LucideIcons.plus400,
                size: 24,
                color: KalloColors.text,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
