import 'dart:ui';

import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../data/session_provider.dart';
import '../../../shared/widgets/nham_primitives.dart';
import '../../../shell/app_header.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../data/countries.dart';
import '../data/profile_providers.dart';
import '../panels/cooking.dart';
import '../widgets/instant_commit_editor.dart';
import '../../feedback/feedback_screen.dart';
import '../widgets/auto_share_to_circle_toggle.dart';
import '../widgets/profile_form.dart';
import '../widgets/profile_status_views.dart';
import '../widgets/region_editor.dart';
import '../widgets/settings_group.dart';
import '../widgets/settings_skeleton.dart';
import '../../circle/data/circle_providers.dart';
import 'about_section.dart';
import 'account_section.dart';
import 'identity_section.dart';

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
                Text(tr('settings.title'), style: dashHeadline()),
                const SizedBox(height: NhamSpacing.sp4),

                // ── Preferences ─────────────────────────────────────────────
                SettingsGroup(
                  label: tr('settings.preferences'),
                  children: [
                    SettingsRow(
                      icon: LucideIcons.user,
                      label: tr('settings.identity.title'),
                      subline: _identitySubline(ref),
                      showChevron: true,
                      onTap: () => _openIdentity(context),
                    ),
                    SettingsRow(
                      icon: LucideIcons.target,
                      label: tr('settings.rows.goalPace'),
                      subline: _goalPaceSubline(context, profile),
                      showChevron: true,
                      onTap: () => _push(context, _EditorKind.goal),
                    ),
                    SettingsRow(
                      icon: LucideIcons.utensilsCrossed,
                      label: tr('settings.rows.cooking'),
                      subline: tr('settings.profilePanel.cookingSubtitle'),
                      showChevron: true,
                      onTap: () => _push(context, _EditorKind.cooking),
                    ),
                    SettingsRow(
                      icon: LucideIcons.globe,
                      label: tr('settings.rows.region'),
                      subline: _regionSubline(context, profile),
                      showChevron: true,
                      onTap: () => _push(context, _EditorKind.region),
                    ),
                    // Hidden until the profile loads (web parity) — an enabled
                    // switch with no profile row can only produce an error.
                    if (profile != null)
                      AutoShareToCircleToggle(value: profile.autoShareToCircle),
                  ],
                ),

                const SizedBox(height: NhamSpacing.sp5),
                // ── Feedback (kept above Account, away from delete-account) ───
                SettingsGroup(
                  label: tr('settings.feedback.groupLabel'),
                  children: [
                    SettingsRow(
                      icon: LucideIcons.messageSquare,
                      label: tr('settings.feedback.rowLabel'),
                      subline: tr('settings.feedback.rowSubline'),
                      showChevron: true,
                      onTap: () => _openFeedback(context),
                    ),
                  ],
                ),

                const SizedBox(height: NhamSpacing.sp5),
                const AccountSection(),

                const SizedBox(height: NhamSpacing.sp5),
                const AboutSection(),
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

  void _openIdentity(BuildContext context) {
    Navigator.of(
      context,
    ).push(MaterialPageRoute<void>(builder: (_) => const IdentityScreen()));
  }

  /// The saved display name, else the invite handle, else "Not set".
  String _identitySubline(WidgetRef ref) {
    final profile = ref.watch(myCircleProfileProvider).valueOrNull;
    if (profile == null) return tr('settings.rows.notSet');
    return profile.label;
  }

  void _openFeedback(BuildContext context) {
    Navigator.of(
      context,
    ).push(MaterialPageRoute<void>(builder: (_) => const FeedbackScreen()));
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
                      child: Text(tr('common.notSignedIn'), style: dashBody()),
                    )
                    : profileAsync.when(
                      loading: () => const SettingsSkeleton(),
                      // A flaky fetch is NOT an absent profile — only a
                      // genuinely-null profile (onboarding never ran) gets the
                      // re-onboarding empty state. An error offers a retry, not
                      // a misleading "Start setup".
                      error:
                          (_, __) => ProfileLoadError(
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
                                  : const ProfileEmpty(),
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
