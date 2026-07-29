import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/circle/data/circle_providers.dart';
import '../features/onboarding/providers/onboarding_providers.dart';
import '../theme/nham_colors.dart';
import 'sidebar_footer.dart';
import 'sidebar_header.dart';
import 'sidebar_nav_list.dart';

/// Left slide-in navigation panel — the Flutter equivalent of the web mobile
/// `MobileNav` Sheet (`components/app/mobile-nav.tsx`).
///
/// Layout (top → bottom):
///   • Header: the brand wordmark, bottom hairline. No identity block — the
///     drawer navigates, and Settings → Profile is where you are.
///   • Scrollable nav list (px-3 py-3, gap-1 between rows).
///   • Pinned footer: optional onboarding nudge and the Settings row. Sign out
///     is not here — it is the bottom-most row of the Settings screen.
///
/// The panel chrome (width 88vw≤320, slide animation, scrim) is owned by
/// [NavDrawer] in `tab_scaffold.dart`; this widget is purely the content.
class Sidebar extends ConsumerWidget {
  const Sidebar({required this.onClose, super.key});

  /// Closes the drawer (used after a nav tap / sign-out).
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final onboardingIncomplete = ref.watch(onboardingResumeProvider);

    final bottomInset = MediaQuery.of(context).padding.bottom;

    // Pending copy/split offers drive the dot on the Circle row (0 while
    // loading/erroring — the badge is ambient, never blocks the drawer).
    final inviteCount =
        ref.watch(mealShareInvitesProvider).valueOrNull?.length ?? 0;

    return Material(
      color: NhamColors.surface,
      // Top inset only — the footer applies its own bottom safe-area padding.
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // ── Header: the wordmark alone ────────────────────────────────
            const SidebarHeader(),

            // ── Scrollable nav list ───────────────────────────────────────
            Expanded(
              child: SidebarNavList(
                inviteCount: inviteCount,
                onClose: onClose,
              ),
            ),

            // ── Pinned footer ─────────────────────────────────────────────
            SidebarFooter(
              ref: ref,
              onClose: onClose,
              onboardingIncomplete: onboardingIncomplete,
              bottomInset: bottomInset,
            ),
          ],
        ),
      ),
    );
  }
}
