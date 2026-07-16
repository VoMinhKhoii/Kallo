import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../theme/nham_colors.dart';
import '../theme/nham_theme.dart';
import '../theme/nham_typography.dart';

/// One drawer nav destination — mirrors the web `NavItemConfig`
/// (`components/app/nav-items.ts`): href, i18n label key, Lucide icon, and the
/// admin-only gate. Lucide glyphs throughout (active state only changes color,
/// never the glyph), matching the rest of the app's iconography.
class NavItem {
  const NavItem({
    required this.href,
    required this.labelKey,
    required this.icon,
    this.adminOnly = false,
  });

  final String href;
  final String labelKey;
  final IconData icon;
  final bool adminOnly;
}

/// A primary nav row. Active = full-width umber pill, white icon+label, 8px
/// radius, subtle btn@20% shadow. Inactive = espresso text with a hover@60%
/// press fill animated over ~150ms (transition-colors).
class NavRow extends StatefulWidget {
  const NavRow({
    required this.item,
    required this.active,
    required this.onTap,
    this.showBadge = false,
    super.key,
  });

  final NavItem item;
  final bool active;
  final VoidCallback onTap;

  /// A pending-attention dot (e.g. unaccepted meal-share invites).
  final bool showBadge;

  @override
  State<NavRow> createState() => _NavRowState();
}

class _NavRowState extends State<NavRow> {
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
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: fill,
          borderRadius: BorderRadius.circular(NhamRadii.md),
          boxShadow:
              active
                  ? const [
                    BoxShadow(
                      color: Color(0x33695E4E),
                      blurRadius: 8,
                      offset: Offset(0, 2),
                    ),
                  ]
                  : null,
        ),
        child: Row(
          children: [
            Icon(widget.item.icon, size: 20, color: contentColor),
            const SizedBox(width: 12),
            Text(
              tr(widget.item.labelKey),
              style: NhamTextStyles.sansMedium(
                fontSize: 14,
              ).copyWith(color: contentColor),
            ),
            if (widget.showBadge) ...[
              const Spacer(),
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: active ? Colors.white : NhamColors.accent,
                  shape: BoxShape.circle,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
