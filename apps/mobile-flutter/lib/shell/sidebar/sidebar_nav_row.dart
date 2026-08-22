import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../theme/calm_tokens.dart';
import '../../theme/kallo_colors.dart';
import '../../theme/kallo_theme.dart';

/// The drawer's ONE glyph size — nav rows and the footer rows below them,
/// which import this rather than restating it.
const double kSidebarIconSize = KalloIcons.size;

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

/// A primary nav row, matched to web `mobile-nav-list.tsx`.
///
/// Selected = the warm hover wash (`KalloColors.hover` #F0EAE0) behind `kInk` at
/// semibold; idle = `kInkMuted` on no fill, with a `pressWash` press animated
/// over ~150ms (`transition-colors`). Flutter used to invert this — a solid
/// umber pill with white content and a drop shadow, i.e. the strongest possible
/// treatment for a row that is merely "where you already are". The wash is the
/// selection language everywhere else in the app (segmented controls, selected
/// cards), so nav now speaks it too, and the shadow is gone: a nav row is not a
/// floating card.
///
/// A selected row keeps its wash while pressed — the wash *is* the press-weight
/// colour, and hover@40/50 over it would read lighter, not deeper.
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
    final Color contentColor = active ? kInk : kInkMuted;
    // Selected keeps the warm wash. An idle row presses on the drawer panel,
    // which paints the canvas — the warm wash is lighter than that and would
    // not register, so the press is the neutral ink one.
    final Color? fill =
        active ? KalloColors.hover : (_pressed ? KalloColors.pressWash : null);

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
          borderRadius: BorderRadius.circular(KalloRadii.md),
        ),
        child: Row(
          children: [
            Icon(widget.item.icon, size: kSidebarIconSize, color: contentColor),
            const SizedBox(width: 12),
            Text(
              tr(widget.item.labelKey),
              style: dashBody(
                color: contentColor,
                weight: active ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
            if (widget.showBadge) ...[
              const Spacer(),
              // Always tan, selected or not (web parity). It used to flip to
              // white on the umber pill; against the new #F0EAE0 wash white
              // would simply disappear.
              Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: KalloColors.accent,
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
