import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../theme/nham_colors.dart';
import '../theme/nham_typography.dart';

/// App shell for the primary surfaces.
///
/// Three-tab cream bottom bar (HIG-native), replacing the web hamburger drawer:
/// **Today** (dashboard) / **Log** (logging, center hero) / **Patterns**
/// (nutrition). A hairline top border, no elevation/shadow. Active = espresso
/// icon + 10px DM Sans label; inactive = muted. `selectionClick` haptic on
/// switch; branch swaps are instant (no cross-page transition). The bar hides
/// when the keyboard is open and respects the bottom safe area.
///
/// Settings/account moved to a 32px avatar disc in the header's right slot
/// ([AppHeader]). Groups + Admin stay reachable as routes but are off the bar
/// (their feature screens aren't built yet).
///
/// go_router's [StatefulNavigationShell] backs the branches so each destination
/// keeps its state/scroll across switches.
class TabScaffold extends StatelessWidget {
  const TabScaffold({required this.navigationShell, super.key});

  final StatefulNavigationShell navigationShell;

  // Branch indices in the router's StatefulShellRoute (declaration order):
  // 0 dashboard · 1 nutrition · 2 logging · 3 groups · 4 admin · 5 settings.
  static const int _branchDashboard = 0;
  static const int _branchNutrition = 1;
  static const int _branchLogging = 2;

  // Tab order on the bar (Today / Log / Patterns) → branch index.
  static const List<_TabSpec> _tabs = [
    _TabSpec(
      branch: _branchDashboard,
      icon: LucideIcons.layoutDashboard,
      labelKey: 'app.tabBar.today',
    ),
    _TabSpec(
      branch: _branchLogging,
      icon: LucideIcons.utensilsCrossed,
      labelKey: 'app.tabBar.log',
    ),
    _TabSpec(
      branch: _branchNutrition,
      icon: LucideIcons.activity,
      labelKey: 'app.tabBar.patterns',
    ),
  ];

  void _onTap(int branch) {
    if (branch != navigationShell.currentIndex) {
      HapticFeedback.selectionClick();
    }
    // goBranch with initialLocation: false preserves the branch's own stack.
    navigationShell.goBranch(
      branch,
      initialLocation: branch == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    final current = navigationShell.currentIndex;
    // Hide the bar when the keyboard is open (composer focused) and on the
    // off-bar branches (Groups/Admin/Settings reached via header/route).
    final keyboardOpen = MediaQuery.of(context).viewInsets.bottom > 0;
    final onBar = _tabs.any((t) => t.branch == current);
    final showBar = onBar && !keyboardOpen;

    return PopScope(
      // System back: from a secondary tab, return to Today rather than exiting.
      canPop: current == _branchDashboard,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        _onTap(_branchDashboard);
      },
      child: Scaffold(
        backgroundColor: NhamColors.surface,
        body: navigationShell,
        bottomNavigationBar: showBar
            ? _BottomBar(tabs: _tabs, currentBranch: current, onTap: _onTap)
            : null,
      ),
    );
  }
}

class _TabSpec {
  const _TabSpec({
    required this.branch,
    required this.icon,
    required this.labelKey,
  });

  final int branch;
  final IconData icon;
  final String labelKey;
}

/// The cream tab bar: a hairline top border, no elevation, safe-area padding.
class _BottomBar extends StatelessWidget {
  const _BottomBar({
    required this.tabs,
    required this.currentBranch,
    required this.onTap,
  });

  final List<_TabSpec> tabs;
  final int currentBranch;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;

    return DecoratedBox(
      decoration: const BoxDecoration(
        color: NhamColors.surface,
        border: Border(
          top: BorderSide(color: NhamColors.borderSoft, width: 1),
        ),
      ),
      child: Padding(
        padding: EdgeInsets.only(bottom: bottomInset),
        child: SizedBox(
          height: 56,
          child: Row(
            children: [
              for (final tab in tabs)
                Expanded(
                  child: _TabItem(
                    spec: tab,
                    active: tab.branch == currentBranch,
                    onTap: () => onTap(tab.branch),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TabItem extends StatelessWidget {
  const _TabItem({
    required this.spec,
    required this.active,
    required this.onTap,
  });

  final _TabSpec spec;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = active ? NhamColors.text : NhamColors.textMuted;
    return Semantics(
      button: true,
      selected: active,
      label: tr(spec.labelKey),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(spec.icon, size: 22, color: color),
            const SizedBox(height: 4),
            Text(
              tr(spec.labelKey),
              style: NhamTextStyles.sansMedium(fontSize: 10).copyWith(
                color: color,
                fontWeight: active ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
