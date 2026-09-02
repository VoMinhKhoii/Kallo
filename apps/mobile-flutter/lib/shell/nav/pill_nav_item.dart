import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/circle/data/circle_providers.dart';
import '../../theme/calm_tokens.dart';
import '../../theme/kallo_theme.dart';
import '../../theme/kallo_typography.dart';
import '../header/app_header_status_dots.dart';

/// One pill-nav tab: a 24pt stroke glyph, ink when active and muted
/// otherwise, filling its flex slot so the whole column is the target (well
/// past 44pt). Icon-only since 2026-09-02 ([kNavShowsLabels]); the tab name
/// still reaches assistive tech through [Semantics].
class PillNavItem extends ConsumerWidget {
  const PillNavItem({
    super.key,
    required this.icon,
    required this.label,
    required this.active,
    required this.onTap,
    this.showInviteBadge = false,
  });

  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;

  /// The Circle tab carries the pending-invite badge that used to live on
  /// the retired hamburger.
  final bool showInviteBadge;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final hasInvites = showInviteBadge &&
        (ref.watch(mealShareInvitesProvider).valueOrNull?.isNotEmpty ?? false);
    final color = active ? kInk : kInkMuted;

    return Expanded(
      child: Semantics(
        button: true,
        selected: active,
        label: label,
        excludeSemantics: true,
        onTap: onTap,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () {
            HapticFeedback.selectionClick();
            onTap();
          },
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  Icon(icon, size: KalloIcons.primary, color: color),
                  if (hasInvites)
                    const Positioned(top: -2, right: -2, child: InviteBadge()),
                ],
              ),
              if (kNavShowsLabels) ...[
                const SizedBox(height: 2),
                Text(
                  label,
                  style: TextStyle(
                    fontFamily: KalloTextStyles.sansFamily,
                    fontSize: 10,
                    fontWeight: FontWeight.w400,
                    color: color,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
