import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../data/session_provider.dart';
import '../../../shared/widgets/nham_primitives.dart';
import '../../../shared/widgets/scroll_separator.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_theme.dart';
import '../data/countries.dart';
import '../data/profile_providers.dart';
import '../logic/settings_spacing.dart';
import '../panels/cooking.dart';
import '../widgets/instant_commit_editor.dart';
import '../../feedback/feedback_screen.dart';
import '../widgets/auto_share_to_circle_toggle.dart';
import '../widgets/profile_form.dart';
import '../widgets/profile_status_views.dart';
import '../widgets/region_editor.dart';
import '../widgets/settings_group.dart';
import '../widgets/settings_header.dart';
import '../widgets/settings_navigator.dart';
import '../widgets/settings_row.dart';
import '../widgets/settings_skeleton.dart';
import '../widgets/sign_out_row.dart';
import '../../circle/data/circle_providers.dart';
import 'about_section.dart';
import 'account_section.dart';
import 'identity_section.dart';

/// Settings tab — a single scrollable root of grouped preference rows, each
/// pushing ONE focused editor. The numeric goal editor keeps the felt save bar;
/// toggle/select editors instant-commit. A nested [Navigator] owns the drill-in
/// so the `/settings` route stays one widget.
///
/// Every route here — the root and each drill-in — is a [CupertinoPageRoute],
/// so the whole stack swipes back edge-to-edge like the rest of the app.
/// [SettingsNavigator] owns the nested stack and the pop arbitration that makes
/// one swipe pop exactly one level.
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) =>
      const SettingsNavigator(root: _SettingsList());
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
      child: ScrollSeparator(
        // The title sits on the header line itself, beside the back chevron —
        // the same slot and the same serif the dashboard greeting uses, so
        // every tab's title lands on one line across the app. Drill-ins render
        // the identical bar with only this text swapped.
        header: SettingsHeader(
          title: tr('settings.title'),
          // The root's back leaves the tab entirely, so it pops the ROUTER,
          // not the nested navigator.
          onBack: () => GoRouter.of(context).pop(),
        ),
        child: ListView(
          padding: SettingsSpacing.rowList,
          children: [
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

            const SizedBox(height: SettingsSpacing.group),
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

            const SizedBox(height: SettingsSpacing.group),
            const AccountSection(),

            const SizedBox(height: SettingsSpacing.group),
            const AboutSection(),

            // ── Sign out — the last row on the screen ──────────────────
            const SizedBox(height: SettingsSpacing.group),
            const SignOutRow(),
          ],
        ),
      ),
    );
  }

  void _push(BuildContext context, _EditorKind kind) {
    Navigator.of(context).push(
      CupertinoPageRoute<void>(builder: (_) => _ProfileScreen(kind: kind)),
    );
  }

  void _openIdentity(BuildContext context) {
    Navigator.of(
      context,
    ).push(CupertinoPageRoute<void>(builder: (_) => const IdentityScreen()));
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
    ).push(CupertinoPageRoute<void>(builder: (_) => const FeedbackScreen()));
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

extension on _EditorKind {
  /// The screen's name — the same l10n key its settings row uses, so the bar
  /// title reads as the row the user just tapped.
  String get title => switch (this) {
    _EditorKind.goal => tr('settings.rows.goalPace'),
    _EditorKind.cooking => tr('settings.rows.cooking'),
    _EditorKind.region => tr('settings.rows.region'),
  };
}

/// Focused profile editor screen — pushed from a settings row. Renders ONE of
/// the goal / cooking / region editors under the shared settings bar, whose
/// only difference from the root's is the title.
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
      child: ScrollSeparator(
        header: SettingsHeader(title: kind.title),
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
                          unawaited(ref.refresh(profileProvider(true).future));
                        },
                      ),
                  data:
                      (profile) =>
                          profile != null
                              ? _editor(profile)
                              : const ProfileEmpty(),
                ),
      ),
    );
  }

  Widget _editor(ProfileRow profile) => switch (kind) {
    _EditorKind.goal => ProfileForm(profile: profile),
    _EditorKind.cooking => InstantCommitEditor(
      profile: profile,
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
