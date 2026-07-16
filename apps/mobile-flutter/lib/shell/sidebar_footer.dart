import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../features/onboarding/widgets/onboarding_dialog.dart';
import '../theme/nham_colors.dart';
import '../theme/nham_theme.dart';
import '../theme/nham_typography.dart';
import 'sidebar_nav_list.dart';
import 'sidebar_onboarding_nudge.dart';
import 'sidebar_sign_out_row.dart';

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
          const SizedBox(height: 4),
          SignOutRow(ref: ref, onClose: onClose),
        ],
      ),
    );
  }
}

/// Footer Settings row — radius 12, 16px icon, 13px medium label; active =
/// umber fill + white; inactive = espresso text w/ hover@60% press fill.
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
    final Color contentColor = active ? Colors.white : NhamColors.text;
    final Color? fill =
        active ? NhamColors.btn : (_pressed ? NhamColors.hover40 : null);

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
          borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
        ),
        child: Row(
          children: [
            Icon(widget.icon, size: 16, color: contentColor),
            const SizedBox(width: 12),
            Text(
              widget.label,
              style: NhamTextStyles.sansMedium(
                fontSize: 13,
              ).copyWith(color: contentColor),
            ),
          ],
        ),
      ),
    );
  }
}
