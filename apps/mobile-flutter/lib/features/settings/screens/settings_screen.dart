import 'dart:ui';

import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../data/session_provider.dart';
import '../../../shared/widgets/nham_primitives.dart';
import '../../../shell/app_header.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../data/countries.dart';
import '../data/profile_providers.dart';
import '../panels/cooking.dart';
import '../widgets/instant_commit_editor.dart';
import '../../../shared/widgets/top_toast.dart';
import '../widgets/profile_form.dart';
import '../widgets/region_editor.dart';
import 'account_section.dart';

/// The marketing version string (no `package_info_plus` dependency in pubspec,
/// so this is rendered statically — keep in sync with `pubspec.yaml`).
const String _appVersion = '1.0.1';
const String _privacyUrl = 'https://kallo.fit/privacy';
const String _termsUrl = 'https://kallo.fit/terms';

/// Settings tab — a single scrollable root of grouped preference rows, each
/// pushing ONE focused editor (Cupertino swipe-back). The numeric goal editor
/// keeps the felt save bar; toggle/select editors instant-commit. A nested
/// [Navigator] owns the drill-in so the `/settings` route stays one widget.
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Navigator(
      onGenerateRoute:
          (settings) => MaterialPageRoute<void>(
            settings: settings,
            builder: (_) => const _SettingsList(),
          ),
    );
  }
}

/// Settings root: grouped preference rows with current-value sublines, the
/// account group, and an about/legal group.
class _SettingsList extends ConsumerWidget {
  const _SettingsList();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(currentSessionProvider);
    final userId = session?.user.id;
    final profileAsync = ref.watch(profileProvider(userId != null));
    final profile = profileAsync.valueOrNull;

    return Screen(
      bottom: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: NhamSpacing.sp3),
            child: AppHeader(onBack: () => GoRouter.of(context).pop()),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(
                NhamSpacing.sp4,
                NhamSpacing.sp2,
                NhamSpacing.sp4,
                NhamSpacing.sp6,
              ),
              children: [
                Text(
                  tr('settings.title'),
                  style: dashHeadline(),
                ),
                const SizedBox(height: NhamSpacing.sp4),

                // ── Preferences ─────────────────────────────────────────────
                _GroupLabel(tr('settings.preferences')),
                _PreferenceRow(
                  icon: LucideIcons.target,
                  label: tr('settings.rows.goalPace'),
                  subline: _goalPaceSubline(context, profile),
                  onTap: () => _push(context, _EditorKind.goal),
                ),
                _PreferenceRow(
                  icon: LucideIcons.utensilsCrossed,
                  label: tr('settings.rows.cooking'),
                  subline: tr('settings.profilePanel.cookingSubtitle'),
                  onTap: () => _push(context, _EditorKind.cooking),
                ),
                _PreferenceRow(
                  icon: LucideIcons.globe,
                  label: tr('settings.rows.region'),
                  subline: _regionSubline(context, profile),
                  onTap: () => _push(context, _EditorKind.region),
                ),

                const SizedBox(height: NhamSpacing.sp5),
                const AccountSection(),

                const SizedBox(height: NhamSpacing.sp5),
                // ── About ───────────────────────────────────────────────────
                _GroupLabel(tr('settings.about.title')),
                _InfoRow(
                  icon: LucideIcons.info,
                  label: tr('settings.about.version'),
                  value: _appVersion,
                ),
                _PreferenceRow(
                  icon: LucideIcons.shieldCheck,
                  label: tr('settings.about.privacy'),
                  subline: _privacyUrl,
                  onTap: () => _copyLink(context, _privacyUrl),
                ),
                _PreferenceRow(
                  icon: LucideIcons.fileText,
                  label: tr('settings.about.terms'),
                  subline: _termsUrl,
                  onTap: () => _copyLink(context, _termsUrl),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _push(BuildContext context, _EditorKind kind) {
    Navigator.of(
      context,
    ).push(MaterialPageRoute<void>(builder: (_) => _ProfileScreen(kind: kind)));
  }

  void _copyLink(BuildContext context, String url) {
    Clipboard.setData(ClipboardData(text: url));
    showTopToast(context, tr('common.copied'));
  }

  /// "Cutting · 0.50 kg/wk" — the saved goal + pace, or "Not set" when no
  /// profile / no goal is configured.
  String _goalPaceSubline(BuildContext context, ProfileRow? profile) {
    if (profile == null) return tr('settings.rows.notSet');
    final goal = profile.goal;
    if (goal == null) return tr('settings.rows.notSet');
    final goalLabel = switch (goal) {
      'cutting' => tr('onboarding.bodyMetrics.cutting'),
      'bulking' => tr('onboarding.bodyMetrics.bulking'),
      _ => tr('onboarding.bodyMetrics.maintaining'),
    };
    if (goal == 'maintaining') return goalLabel;
    final aggression = double.tryParse(profile.aggression ?? '');
    if (aggression == null) return goalLabel;
    final unit = tr('onboarding.bodyMetrics.weightUnit');
    // Locale decimal separator (vi "0,50") + localized per-week suffix.
    final paceFmt =
        NumberFormat.decimalPattern(context.locale.languageCode)
          ..minimumFractionDigits = 2
          ..maximumFractionDigits = 2;
    final pace = tr(
      'settings.rows.pacePerWeek',
      namedArgs: {'pace': paceFmt.format(aggression), 'unit': unit},
    );
    return '$goalLabel · $pace';
  }

  /// "Việt Nam · Tiếng Việt" — residence country + current app language, or
  /// just the language when no country is set.
  String _regionSubline(BuildContext context, ProfileRow? profile) {
    final lang = context.locale.languageCode == 'vi' ? 'Tiếng Việt' : 'English';
    final residence = profile?.countryOfResidence;
    if (residence == null || residence.isEmpty) return lang;
    final label = _countryLabel(residence, context.locale.languageCode);
    return '$label · $lang';
  }

  String _countryLabel(String value, String locale) {
    for (final c in kCountries) {
      if (c.value == value) return locale == 'vi' ? c.vi : c.value;
    }
    return value;
  }
}

/// The focused editor a preference row pushes onto the stack.
enum _EditorKind { goal, cooking, region }

class _GroupLabel extends StatelessWidget {
  const _GroupLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: NhamSpacing.sp3, bottom: 4),
      child: Text(
        text.toUpperCase(),
        style: dashEyebrow(),
      ),
    );
  }
}

/// A grouped preference row: an icon, a label with a current-value subline, and
/// a trailing chevron. Presses fade the hover fill in and darken the text.
class _PreferenceRow extends StatefulWidget {
  const _PreferenceRow({
    required this.icon,
    required this.label,
    required this.subline,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String subline;
  final VoidCallback onTap;

  @override
  State<_PreferenceRow> createState() => _PreferenceRowState();
}

class _PreferenceRowState extends State<_PreferenceRow> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      excludeSemantics: true,
      label: '${widget.label}, ${widget.subline}',
      onTap: widget.onTap,
      child: GestureDetector(
        onTap: widget.onTap,
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: NhamSpacing.sp3,
            vertical: 10,
          ),
          decoration: BoxDecoration(
            color: _pressed ? NhamColors.hover50 : Colors.transparent,
            borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
          ),
          child: Row(
            children: [
              Icon(
                widget.icon,
                size: 16,
                color: _pressed ? NhamColors.text : NhamColors.textMuted,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.label,
                      style: dashBody(),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      widget.subline,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: dashMeta(),
                    ),
                  ],
                ),
              ),
              const Icon(
                LucideIcons.chevronRight,
                size: 16,
                color: NhamColors.textMuted50,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A non-navigating info row (label on the left, a static value on the right) —
/// used for the app version.
class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: NhamSpacing.sp3,
        vertical: 10,
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: NhamColors.textMuted),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              label,
              style: dashBody(),
            ),
          ),
          Text(
            value,
            style: dashMeta(tabular: true),
          ),
        ],
      ),
    );
  }
}

/// Focused profile editor screen — pushed from a settings row. Renders ONE of
/// the goal / cooking / region editors. Back header mirrors the web shell's
/// ArrowLeft + "Settings" link.
class _ProfileScreen extends ConsumerWidget {
  const _ProfileScreen({required this.kind});

  final _EditorKind kind;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(currentSessionProvider);
    final userId = session?.user.id;
    final profileAsync = ref.watch(profileProvider(userId != null));

    return Screen(
      bottom: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const _BackHeader(),
          Expanded(
            child:
                userId == null
                    ? _Centered(
                      child: Text(
                        tr('common.notSignedIn'),
                        style: dashBody(),
                      ),
                    )
                    : profileAsync.when(
                      loading:
                          () => const _Centered(
                            child: CircularProgressIndicator(
                              valueColor: AlwaysStoppedAnimation(
                                NhamColors.accent,
                              ),
                            ),
                          ),
                      // A flaky fetch is NOT an absent profile — only a
                      // genuinely-null profile (onboarding never ran) gets the
                      // re-onboarding empty state. An error offers a retry, not
                      // a misleading "Start setup".
                      error:
                          (_, __) => _ProfileLoadError(
                            onRetry: () {
                              unawaited(
                                ref.refresh(profileProvider(true).future),
                              );
                            },
                          ),
                      data:
                          (profile) =>
                              profile != null
                                  ? _editor(profile)
                                  : const _ProfileEmpty(),
                    ),
          ),
        ],
      ),
    );
  }

  Widget _editor(ProfileRow profile) => switch (kind) {
    _EditorKind.goal => ProfileForm(profile: profile),
    _EditorKind.cooking => InstantCommitEditor(
      profile: profile,
      title: tr('settings.rows.cooking'),
      subtitle: tr('settings.profilePanel.cookingSubtitle'),
      child: const Cooking(),
    ),
    _EditorKind.region => RegionEditor(profile: profile),
  };
}

class _Centered extends StatelessWidget {
  const _Centered({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(NhamSpacing.sp6),
      child: child,
    ),
  );
}

/// Empty state when no profile exists yet (onboarding never ran).
class _ProfileEmpty extends StatelessWidget {
  const _ProfileEmpty();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: NhamSpacing.sp5),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            tr('settings.profilePage.emptyTitle'),
            style: NhamTextStyles.serifRegular(
              fontSize: NhamFontSize.h3,
            ).copyWith(
              letterSpacing: NhamTracking.tight,
              color: NhamColors.text,
            ),
          ),
          const SizedBox(height: NhamSpacing.sp4),
          Text(
            tr('settings.profilePage.emptyDescription'),
            style: dashBody(color: kInkMuted),
          ),
          const SizedBox(height: NhamSpacing.sp4),
          // RN routes "Start setup" to /logging (where the onboarding overlay
          // resumes). go_router resolves via the root navigator from any
          // descendant context, so this crosses tabs correctly.
          Align(
            alignment: Alignment.centerLeft,
            child: Semantics(
              button: true,
              excludeSemantics: true,
              label: tr('settings.profilePage.startSetup'),
              onTap: () => context.go('/logging'),
              child: GestureDetector(
                onTap: () => context.go('/logging'),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: NhamSpacing.sp5,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: NhamColors.text,
                    borderRadius: BorderRadius.circular(NhamRadii.pill),
                  ),
                  child: Text(
                    tr('settings.profilePage.startSetup'),
                    style: dashBody(weight: FontWeight.w500, color: Colors.white),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Profile load failed (a flaky fetch, not an absent profile). Shows a neutral
/// error + a retry — never the re-onboarding "Start setup" CTA, which would
/// strand a configured user in a false "set up your profile" dead-end.
class _ProfileLoadError extends StatelessWidget {
  const _ProfileLoadError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: NhamSpacing.sp5),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            tr('common.error'),
            style: NhamTextStyles.serifRegular(
              fontSize: NhamFontSize.h3,
            ).copyWith(
              letterSpacing: NhamTracking.tight,
              color: NhamColors.text,
            ),
          ),
          const SizedBox(height: NhamSpacing.sp4),
          Align(
            alignment: Alignment.centerLeft,
            child: Semantics(
              button: true,
              excludeSemantics: true,
              label: tr('common.retry'),
              onTap: onRetry,
              child: GestureDetector(
                onTap: onRetry,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: NhamSpacing.sp5,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: NhamColors.text,
                    borderRadius: BorderRadius.circular(NhamRadii.pill),
                  ),
                  child: Text(
                    tr('common.retry'),
                    style: dashBody(weight: FontWeight.w500, color: Colors.white),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Sticky back header — mirrors the web shell's translucent cream/90 bar with
/// a backdrop blur, a bottom border, and the ArrowLeft + "Settings" link whose
/// text darkens (textWarm → text) on press.
class _BackHeader extends StatefulWidget {
  const _BackHeader();

  @override
  State<_BackHeader> createState() => _BackHeaderState();
}

class _BackHeaderState extends State<_BackHeader> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final color = _pressed ? kInk : kInkMuted;
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8), // backdrop-blur-sm
        child: Semantics(
          button: true,
          excludeSemantics: true,
          label: tr('settings.title'),
          onTap: () => Navigator.of(context).pop(),
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => Navigator.of(context).pop(),
            onTapDown: (_) => setState(() => _pressed = true),
            onTapUp: (_) => setState(() => _pressed = false),
            onTapCancel: () => setState(() => _pressed = false),
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: NhamSpacing.sp4,
                vertical: NhamSpacing.sp3,
              ),
              decoration: const BoxDecoration(
                color: Color(0xE6FDFCF8), // cream @ 90%
                border: Border(
                  bottom: BorderSide(color: NhamColors.inputBorder),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(LucideIcons.arrowLeft, size: 16, color: color),
                  const SizedBox(width: 6), // gap-1.5
                  Text(
                    tr('settings.title'),
                    style: dashBody(weight: FontWeight.w500, color: color),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
