import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../features/onboarding/widgets/onboarding_dialog.dart';
import '../theme/calm_tokens.dart';
import '../theme/nham_colors.dart';
import '../theme/nham_theme.dart';
import 'sidebar_nav_list.dart';
import 'sidebar_nav_row.dart' show kSidebarIconSize;
import 'sidebar_onboarding_nudge.dart';

class SidebarFooter extends StatelessWidget {
  const SidebarFooter({
    required this.ref,
    required this.onClose,
    required this.onboardingIncomplete,
    required this.bottomInset,
    super.key,
  });

  final WidgetRef ref;
  final VoidCallback onClose;
  final bool onboardingIncomplete;
  final double bottomInset;

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        color: Color(0x66FFFFFF),
        border: Border(
          top: BorderSide(color: NhamColors.borderBiscotti40, width: 1),
        ),
      ),
      padding: EdgeInsets.fromLTRB(
        NhamSpacing.sp3,
        NhamSpacing.sp3,
        NhamSpacing.sp3,
        bottomInset + NhamSpacing.sp3,
      ),
      child: Column(
        children: [
          if (onboardingIncomplete) ...[
            OnboardingNudge(
              onResume: () {
                onClose();
                showOnboardingDialog(context, ref);
              },
            ),
            const SizedBox(height: 12),
          ],
          FooterRow(
            icon: LucideIcons.settings,
            label: tr('app.mainSidebar.settings'),
            active: isActiveRoute(location, '/settings'),
            onTap: () {
              onClose();
              // Push so settings stacks over the shell and can swipe back.
              context.push('/settings');
            },
          ),
          // Sign out is NOT here: it lives at the bottom of Settings, in red,
          // so the drawer stays pure navigation and the session action sits
          // with the other account actions.
        ],
      ),
    );
  }
}

/// Footer Settings row — visually identical to [NavRow] above it: the warm
/// hover wash + ink + semibold when active, muted when idle.
class FooterRow extends StatefulWidget {
  const FooterRow({
    required this.icon,
    required this.label,
    required this.active,
    required this.onTap,
    super.key,
  });

  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  State<FooterRow> createState() => _FooterRowState();
}

class _FooterRowState extends State<FooterRow> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final active = widget.active;
    // Identical to NavRow above it — this row sits in the same column and had
    // been left on the old inverted scheme (umber fill + white content, ink
    // when idle), so the drawer read as two different components.
    final Color contentColor = active ? kInk : kInkMuted;
    final Color? fill =
        active ? NhamColors.hover : (_pressed ? NhamColors.pressWash : null);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        curve: Curves.easeInOut,
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: fill,
          borderRadius: BorderRadius.circular(NhamRadii.md),
        ),
        child: Row(
          children: [
            Icon(widget.icon, size: kSidebarIconSize, color: contentColor),
            const SizedBox(width: 12),
            Text(
              widget.label,
              style: dashBody(
                color: contentColor,
                weight: active ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
