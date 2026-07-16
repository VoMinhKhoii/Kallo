import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../data/session_provider.dart';
import '../features/circle/data/circle_providers.dart';
import '../features/onboarding/providers/onboarding_providers.dart';
import '../theme/nham_colors.dart';
import 'sidebar_account_header.dart';
import 'sidebar_footer.dart';
import 'sidebar_nav_list.dart';

/// Left slide-in navigation panel — the Flutter equivalent of the web mobile
/// `MobileNav` Sheet (`components/app/mobile-nav.tsx`).
///
/// Layout (top → bottom):
///   • Header: display name (15px) + email (11.5px), bottom hairline.
///   • Scrollable nav list (px-3 py-3, gap-1 between rows).
///   • Pinned footer: optional onboarding nudge, account card, Settings row,
///     Sign-out row.
///
/// The panel chrome (width 88vw≤320, slide animation, scrim) is owned by
/// [NavDrawer] in `tab_scaffold.dart`; this widget is purely the content.
class Sidebar extends ConsumerWidget {
  const Sidebar({required this.onClose, super.key});

  /// Closes the drawer (used after a nav tap / sign-out).
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(currentSessionProvider);
    final user = session?.user;
    final email = user?.email;
    final displayName = _deriveName(user);
    final label = displayName ?? _accountFallback();

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
            // ── Header: avatar + name + email (the primary identity block) ──
            SidebarAccountHeader(label: label, email: email),

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

  static String? _deriveName(User? user) {
    final meta = user?.userMetadata;
    final raw = (meta?['displayName'] ?? meta?['full_name'] ?? meta?['name']);
    if (raw is String && raw.trim().isNotEmpty) return raw.trim();
    final email = user?.email;
    if (email != null && email.contains('@')) return email.split('@').first;
    return email;
  }

  static String _accountFallback() => tr('app.userMenu.account');
}
