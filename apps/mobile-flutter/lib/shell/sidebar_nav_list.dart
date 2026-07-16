import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../theme/nham_theme.dart';
import 'sidebar_nav_row.dart';

// Order + membership mirror `NAV_ITEMS` exactly:
// dashboard, nutrition, logging, groups, admin (admin-only).
const List<NavItem> _navItems = [
  NavItem(
    href: '/dashboard',
    labelKey: 'app.mainSidebar.dashboard',
    icon: LucideIcons.layoutDashboard,
  ),
  NavItem(
    href: '/nutrition',
    labelKey: 'app.mainSidebar.nutrition',
    icon: LucideIcons.activity,
  ),
  NavItem(
    href: '/logging',
    labelKey: 'app.mainSidebar.logging',
    icon: LucideIcons.utensilsCrossed,
  ),
  NavItem(
    href: '/circle',
    labelKey: 'app.mainSidebar.groups',
    icon: LucideIcons.users,
  ),
  NavItem(
    href: '/admin',
    labelKey: 'app.mainSidebar.admin',
    icon: LucideIcons.shieldCheck,
    adminOnly: true,
  ),
];

bool isActiveRoute(String location, String href) {
  if (location == href) return true;
  return location.startsWith('$href/');
}

class SidebarNavList extends StatelessWidget {
  const SidebarNavList({
    required this.inviteCount,
    required this.onClose,
    super.key,
  });

  final int inviteCount;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    // Admin gating isn't surfaced in the mobile data layer yet; match the web
    // default (non-admin) until an isAdmin provider exists.
    const isAdmin = false;
    final items = _navItems
        .where((item) => isAdmin || !item.adminOnly)
        .toList(growable: false);
    final location = GoRouterState.of(context).matchedLocation;

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(
        horizontal: NhamSpacing.sp3,
        vertical: NhamSpacing.sp3,
      ),
      child: Column(
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) const SizedBox(height: 4),
            NavRow(
              item: items[i],
              active: isActiveRoute(location, items[i].href),
              showBadge: items[i].href == '/circle' && inviteCount > 0,
              onTap: () {
                onClose();
                context.go(items[i].href);
              },
            ),
          ],
        ],
      ),
    );
  }
}
