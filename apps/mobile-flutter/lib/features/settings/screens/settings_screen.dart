import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../services/auth/session_provider.dart';
import '../../../services/billing/entitlements_provider.dart';
import '../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../shared/widgets/surface/scroll_separator.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';
import '../../../shared/data/countries.dart';
import '../data/profile_providers.dart';
import '../logic/settings_spacing.dart';
import 'cooking.dart';
import '../widgets/profile/instant_commit_editor.dart';
import '../widgets/account/auto_share_to_circle_toggle.dart';
import '../../onboarding/providers/onboarding_providers.dart'
    show onboardingResumeProvider;
import '../../onboarding/widgets/onboarding_dialog.dart';
import '../../onboarding/widgets/onboarding_nudge.dart';
import '../widgets/profile/profile_form.dart';
import '../widgets/profile/profile_status_views.dart';
import '../widgets/profile/region_editor.dart';
import '../widgets/list/settings_group.dart';
import '../widgets/chrome/settings_header.dart';
import '../widgets/chrome/settings_navigator.dart';
import '../widgets/list/settings_row.dart';
import '../widgets/profile/settings_skeleton.dart';
import '../widgets/account/sign_out_row.dart';
import '../widgets/account/subscription_section.dart';
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
    final showSubscription = ref.watch(subscriptionSectionVisibleProvider);

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
            // Resume-onboarding nudge — re-homed here from the retired
            // drawer footer; the dashboard avatar's pulse-dot points at it.
            if (ref.watch(onboardingResumeProvider)) ...[
              OnboardingNudge(
                onResume: () => showOnboardingDialog(context, ref),
              ),
              const SizedBox(height: KalloSpacing.sp3),
            ],
            // ── Preferences ─────────────────────────────────────────────
            SettingsGroup(
              label: tr('settings.preferences'),
              children: [
                SettingsRow(
                  icon: LucideIcons.user300,
                  label: tr('settings.identity.title'),
                  subline: _identitySubline(ref),
                  showChevron: true,
                  onTap: () => _openIdentity(context),
                ),
                SettingsRow(
                  icon: LucideIcons.target300,
                  label: tr('settings.rows.goalPace'),
                  subline: _goalPaceSubline(context, profile),
                  showChevron: true,
                  onTap: () => _push(context, _EditorKind.goal),
                ),
                // No subline: its description is the first thing the cooking
                // editor itself shows, and in a single-line ellipsised slot it
                // only ever rendered as a truncated fragment.
                SettingsRow(
                  icon: LucideIcons.utensilsCrossed300,
                  label: tr('settings.rows.cooking'),
                  showChevron: true,
                  onTap: () => _push(context, _EditorKind.cooking),
                ),
                SettingsRow(
                  icon: LucideIcons.globe300,
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

            // The one conditional section on the screen, so the gap above it
            // belongs to the condition too: a section that hid itself while
            // the parent kept emitting both gaps left a 48px void behind.
            if (showSubscription) ...[
              const SizedBox(height: SettingsSpacing.group),
              const SubscriptionSection(),
            ],

            const SizedBox(height: SettingsSpacing.group),
            const AccountSection(),

            // ── About — version, legal, and the feedback row ───────────
            // It sits between the delete-account row and sign out, which is
            // what keeps the session action people reach for by habit from
            // stacking against the irreversible one.
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
      padding: const EdgeInsets.all(KalloSpacing.sp6),
      child: child,
    ),
  );
}
