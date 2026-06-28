import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../data/session_provider.dart';
import '../features/onboarding/providers/onboarding_providers.dart';
import '../features/onboarding/widgets/onboarding_dialog.dart';
import '../shared/widgets/top_toast.dart';
import '../theme/nham_colors.dart';
import '../theme/nham_theme.dart';
import '../theme/nham_typography.dart';

/// One drawer nav destination — mirrors the web `NavItemConfig`
/// (`components/app/nav-items.ts`): href, i18n label key, Lucide icon, and the
/// admin-only gate. Lucide glyphs throughout (active state only changes color,
/// never the glyph), matching the rest of the app's iconography.
class _NavItem {
  const _NavItem({
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

// Order + membership mirror `NAV_ITEMS` exactly:
// dashboard, nutrition, logging, groups, admin (admin-only).
const List<_NavItem> _navItems = [
  _NavItem(
    href: '/dashboard',
    labelKey: 'app.mainSidebar.dashboard',
    icon: LucideIcons.layoutDashboard,
  ),
  _NavItem(
    href: '/nutrition',
    labelKey: 'app.mainSidebar.nutrition',
    icon: LucideIcons.activity,
  ),
  _NavItem(
    href: '/logging',
    labelKey: 'app.mainSidebar.logging',
    icon: LucideIcons.utensilsCrossed,
  ),
  _NavItem(
    href: '/groups',
    labelKey: 'app.mainSidebar.groups',
    icon: LucideIcons.users,
  ),
  _NavItem(
    href: '/admin',
    labelKey: 'app.mainSidebar.admin',
    icon: LucideIcons.shieldCheck,
    adminOnly: true,
  ),
];

bool _isActiveRoute(String location, String href) {
  if (location == href) return true;
  return location.startsWith('$href/');
}

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

    // Admin gating isn't surfaced in the mobile data layer yet; match the web
    // default (non-admin) until an isAdmin provider exists.
    const isAdmin = false;
    final items = _navItems
        .where((i) => isAdmin || !i.adminOnly)
        .toList(growable: false);

    final location = GoRouterState.of(context).matchedLocation;
    final bottomInset = MediaQuery.of(context).padding.bottom;

    return Material(
      color: NhamColors.surface,
      // Top inset only — the footer applies its own bottom safe-area padding.
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            // ── Header: name + email ──────────────────────────────────────
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(
                horizontal: NhamSpacing.sp4,
                vertical: NhamSpacing.sp4,
              ),
              decoration: const BoxDecoration(
                border: Border(
                  bottom: BorderSide(
                    color: NhamColors.borderBiscotti40,
                    width: 1,
                  ),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: NhamTextStyles.sansRegular(
                      fontSize: 15,
                    ).copyWith(color: NhamColors.text),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (email != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      email,
                      style: NhamTextStyles.sansRegular(
                        fontSize: 11.5,
                      ).copyWith(color: NhamColors.textMuted),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),

            // ── Scrollable nav list ───────────────────────────────────────
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(
                  horizontal: NhamSpacing.sp3,
                  vertical: NhamSpacing.sp3,
                ),
                child: Column(
                  children: [
                    for (var i = 0; i < items.length; i++) ...[
                      if (i > 0) const SizedBox(height: 4),
                      _NavRow(
                        item: items[i],
                        active: _isActiveRoute(location, items[i].href),
                        onTap: () {
                          onClose();
                          context.go(items[i].href);
                        },
                      ),
                    ],
                  ],
                ),
              ),
            ),

            // ── Pinned footer ─────────────────────────────────────────────
            Container(
              width: double.infinity,
              decoration: const BoxDecoration(
                color: Color(0x66FFFFFF), // white @ 40%
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
                    _OnboardingNudge(
                      onResume: () {
                        onClose();
                        showOnboardingDialog(context, ref);
                      },
                    ),
                    const SizedBox(height: 12),
                  ],
                  _AccountCard(label: label, email: email),
                  const SizedBox(height: 8), // mt-2
                  _FooterRow(
                    icon: LucideIcons.settings,
                    label: tr('app.mainSidebar.settings'),
                    active: _isActiveRoute(location, '/settings'),
                    onTap: () {
                      onClose();
                      context.go('/settings');
                    },
                  ),
                  const SizedBox(height: 4), // mt-1
                  _SignOutRow(ref: ref, onClose: onClose),
                ],
              ),
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

/// A primary nav row. Active = full-width umber pill, white icon+label, 8px
/// radius, subtle btn@20% shadow. Inactive = espresso text with a hover@60%
/// press fill animated over ~150ms (transition-colors).
class _NavRow extends StatefulWidget {
  const _NavRow({
    required this.item,
    required this.active,
    required this.onTap,
  });

  final _NavItem item;
  final bool active;
  final VoidCallback onTap;

  @override
  State<_NavRow> createState() => _NavRowState();
}

class _NavRowState extends State<_NavRow> {
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
          borderRadius: BorderRadius.circular(NhamRadii.md), // rounded-lg = 8
          boxShadow:
              active
                  ? const [
                    BoxShadow(
                      color: Color(0x33695E4E), // btn @ 20%
                      blurRadius: 8,
                      offset: Offset(0, 2),
                    ),
                  ]
                  : null,
        ),
        child: Row(
          children: [
            Icon(widget.item.icon, size: 20, color: contentColor),
            const SizedBox(width: 12), // gap-3
            Text(
              tr(widget.item.labelKey),
              style: NhamTextStyles.sansMedium(
                fontSize: 14,
              ).copyWith(color: contentColor),
            ),
          ],
        ),
      ),
    );
  }
}

/// Footer account card — white fill, radius 12, 36px gradient avatar w/ ring,
/// bold initial, name + email column (both truncated).
class _AccountCard extends StatelessWidget {
  const _AccountCard({required this.label, required this.email});

  final String label;
  final String? email;

  @override
  Widget build(BuildContext context) {
    final initial = _deriveInitial(label, email);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(
          NhamRadii.buttonXl,
        ), // rounded-xl=12
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0x66C9A87C), // accent @ 40%
                  Color(0x8CE8D5B5), // border @ 55%
                ],
              ),
              border: Border.all(
                color: const Color(0x40C9A87C), // accent @ 25%
                width: 1,
              ),
            ),
            child: Text(
              initial,
              style: NhamTextStyles.sansBold(
                fontSize: 13,
              ).copyWith(color: NhamColors.btn),
            ),
          ),
          const SizedBox(width: 12), // gap-3
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: NhamTextStyles.sansMedium(
                    fontSize: 13,
                  ).copyWith(color: NhamColors.text),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (email != null)
                  Text(
                    email!,
                    style: NhamTextStyles.sansRegular(
                      fontSize: 11,
                    ).copyWith(color: NhamColors.textMuted),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static String _deriveInitial(String label, String? email) {
    final source = label.trim().isNotEmpty ? label.trim() : (email ?? '');
    if (source.isEmpty) return '·';
    return source.characters.first.toUpperCase();
  }
}

/// Footer Settings row — radius 12, 16px icon, 13px medium label; active =
/// umber fill + white; inactive = espresso text w/ hover@60% press fill.
class _FooterRow extends StatefulWidget {
  const _FooterRow({
    required this.icon,
    required this.label,
    required this.active,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  State<_FooterRow> createState() => _FooterRowState();
}

class _FooterRowState extends State<_FooterRow> {
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
          borderRadius: BorderRadius.circular(NhamRadii.buttonXl), // 12
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

/// Footer Sign-out row — danger text, danger@10% press fill, opacity 60% +
/// disabled while the request is in flight.
class _SignOutRow extends StatefulWidget {
  const _SignOutRow({required this.ref, required this.onClose});

  final WidgetRef ref;
  final VoidCallback onClose;

  @override
  State<_SignOutRow> createState() => _SignOutRowState();
}

class _SignOutRowState extends State<_SignOutRow> {
  bool _pressed = false;
  bool _signingOut = false;

  Future<void> _signOut() async {
    if (_signingOut) return;
    setState(() => _signingOut = true);
    try {
      await widget.ref.read(authControllerProvider).signOut();
      if (!mounted) return;
      // Close the drawer, then route to /sign-in explicitly. The router's auth
      // refresh also redirects on the cleared session, but the explicit nav is
      // a backstop so a missed redirect can't strand the user in the app.
      widget.onClose();
      context.go('/sign-in');
    } catch (error) {
      // Don't swallow it: reset so the row is tappable again and tell the user.
      debugPrint('Sign-out failed: $error');
      if (!mounted) return;
      setState(() => _signingOut = false);
      showTopToast(
        context,
        tr('app.userMenu.signOutError'),
        variant: TopToastVariant.error,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final Color? fill =
        _pressed ? const Color(0x1AD37B69) : null; // danger @ 10%

    return Opacity(
      opacity: _signingOut ? 0.6 : 1.0,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: _signingOut ? null : (_) => setState(() => _pressed = true),
        onTapUp: _signingOut ? null : (_) => setState(() => _pressed = false),
        onTapCancel:
            _signingOut ? null : () => setState(() => _pressed = false),
        onTap: _signingOut ? null : _signOut,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          curve: Curves.easeInOut,
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: fill,
            borderRadius: BorderRadius.circular(NhamRadii.buttonXl), // 12
          ),
          child: Row(
            children: [
              const Icon(LucideIcons.logOut, size: 16, color: NhamColors.danger),
              const SizedBox(width: 12),
              Text(
                tr('app.userMenu.signOut'),
                style: NhamTextStyles.sansMedium(
                  fontSize: 13,
                ).copyWith(color: NhamColors.danger),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Mobile onboarding nudge — gradient surface (accent/10 → surface → hover/55),
/// 16px radius, accent@25 ring, p-16, step counter, title (12px), description
/// (11px), 1px progress bar (accent over border/40), umber CTA.
class _OnboardingNudge extends ConsumerWidget {
  const _OnboardingNudge({required this.onResume});

  final VoidCallback onResume;

  static const int _total = 3; // ONBOARDING_TOTAL_STEPS

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rawStep = ref.watch(onboardingResumeStepProvider); // 1-based
    final safeStep = rawStep.clamp(1, _total);
    final completed = (safeStep - 1).clamp(0, _total);
    final progressPct = completed / _total;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(NhamSpacing.sp4), // p-4 = 16
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(NhamRadii.xxl), // rounded-2xl = 18
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0x1AC9A87C), // accent @ 10%
            NhamColors.surface,
            Color(0x8CF0EAE0), // hover @ 55%
          ],
        ),
        border: Border.all(
          color: const Color(0x40C9A87C), // accent @ 25%
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Step counter row (sparkle chip + counter).
          Row(
            children: [
              Container(
                width: 20,
                height: 20,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: const Color(0x33C9A87C), // accent @ 20%
                  borderRadius: BorderRadius.circular(NhamRadii.md),
                ),
                child: const Icon(
                  LucideIcons.sparkles,
                  size: 12,
                  color: NhamColors.accent,
                ),
              ),
              const SizedBox(width: 6), // gap-1.5
              Text(
                tr(
                  'app.onboardingNudge.stepCounter',
                  namedArgs: {'current': '$safeStep', 'total': '$_total'},
                ).toUpperCase(),
                style: NhamTextStyles.sansMedium(fontSize: 10).copyWith(
                  color: NhamColors.textMuted,
                  letterSpacing: 0.6, // 0.06em of 10px
                ),
              ),
            ],
          ),
          const SizedBox(height: 8), // mb-2
          Text(
            tr('app.onboardingNudge.title'),
            style: NhamTextStyles.sansMedium(
              fontSize: 12,
              height: NhamLeading.snug,
            ).copyWith(color: NhamColors.text),
          ),
          const SizedBox(height: 4), // mb-1
          Text(
            tr('app.onboardingNudge.description'),
            style: NhamTextStyles.sansRegular(
              fontSize: 11,
              height: NhamLeading.relaxed,
            ).copyWith(color: NhamColors.textMuted),
          ),
          const SizedBox(height: 12), // mb-3
          // Progress bar: 1px high track (border/40), accent fill, 500ms ease-out.
          ClipRRect(
            borderRadius: BorderRadius.circular(NhamRadii.pill),
            child: Container(
              height: 4, // h-1 = 4px
              color: NhamColors.borderBiscotti40,
              child: LayoutBuilder(
                builder: (context, constraints) {
                  return AnimatedContainer(
                    duration: const Duration(milliseconds: 500),
                    curve: Curves.easeOut,
                    width: constraints.maxWidth * progressPct,
                    decoration: BoxDecoration(
                      color: NhamColors.accent,
                      borderRadius: BorderRadius.circular(NhamRadii.pill),
                    ),
                  );
                },
              ),
            ),
          ),
          const SizedBox(height: 12), // mb-3
          _NudgeCta(onTap: onResume),
        ],
      ),
    );
  }
}

/// Umber CTA inside the nudge — full-width, radius 8, 11px medium white label,
/// btn→btnHover press shift over ~150ms.
class _NudgeCta extends StatefulWidget {
  const _NudgeCta({required this.onTap});

  final VoidCallback onTap;

  @override
  State<_NudgeCta> createState() => _NudgeCtaState();
}

class _NudgeCtaState extends State<_NudgeCta> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
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
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: _pressed ? NhamColors.btnHover : NhamColors.btn,
          borderRadius: BorderRadius.circular(NhamRadii.md), // rounded-lg = 8
          boxShadow: const [
            BoxShadow(
              color: Color(0x33695E4E), // btn @ 20%
              blurRadius: 8,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: Text(
          tr('app.onboardingNudge.cta'),
          style: NhamTextStyles.sansMedium(
            fontSize: 11,
          ).copyWith(color: Colors.white),
        ),
      ),
    );
  }
}
