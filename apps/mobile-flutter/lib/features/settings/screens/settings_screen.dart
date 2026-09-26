import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../services/billing/entitlements_provider.dart';
import '../../../shared/widgets/chrome/page_header.dart';
import '../../../shared/widgets/list/grouped_list_card.dart';
import '../../../shared/widgets/list/list_row.dart';
import '../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../shared/widgets/surface/scroll_separator.dart';
import '../../../theme/calm_tokens.dart';
import '../../onboarding/data/profile_row.dart';
import '../../onboarding/providers/onboarding_providers.dart'
    show onboardingResumeProvider, profileProvider;
import '../../onboarding/widgets/onboarding_dialog.dart';
import '../../onboarding/widgets/onboarding_nudge.dart';
import '../logic/profile_summaries.dart';
import '../logic/settings_spacing.dart';
import '../widgets/account/ai_consent_toggle.dart';
import '../widgets/account/auto_share_to_circle_toggle.dart';
import '../widgets/account/sign_out_row.dart';
import '../widgets/account/subscription_section.dart';
import '../widgets/chrome/settings_navigator.dart';
import '../widgets/list/settings_group.dart';
import '../widgets/profile/settings_profile_card.dart';
import 'about_section.dart';
import 'account_section.dart';
import 'identity_section.dart';
import 'steps/about_you_page.dart';
import 'steps/cooking_page.dart';
import 'steps/goal_pace_page.dart';
import 'steps/region_page.dart';

/// Settings — a single scrollable root of grouped preference cards, each row
/// pushing ONE focused page. A nested [Navigator] owns the drill-in so the
/// `/settings` route stays one widget.
///
/// Every push here — the root's and each drill-in's — is a [MaterialPageRoute]:
/// the app's full-width back drag is installed through the theme, and a
/// `CupertinoPageRoute` opts its page out of it (`kallo-design/mobile.md`,
/// *Routes*). The drill-ins used to be Cupertino routes, which is why paging
/// through Settings slid and swiped differently from the rest of the app.
/// [SettingsNavigator] owns the nested stack and the pop arbitration that makes
/// one swipe pop exactly one level.
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) =>
      const SettingsNavigator(root: _SettingsList());
}

/// Settings root: the person's card, the nutrition profile (one row per
/// onboarding step, each saying what it holds), preferences, account and
/// about, sign out, version.
///
/// The whole list is one uniform 12pt stack (label, card, label, card…) —
/// the CARD is the grouping device, so no section needs a wider gap.
class _SettingsList extends ConsumerWidget {
  const _SettingsList();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileProvider).valueOrNull;
    final showSubscription = ref.watch(subscriptionSectionVisibleProvider);

    final items = <Widget>[
      // Resume-onboarding nudge — the dashboard avatar's pulse-dot points at
      // it. For a profile that is still blank it is the fastest way through:
      // one linear flow, no back-and-forth between these rows.
      if (ref.watch(onboardingResumeProvider))
        OnboardingNudge(onResume: () => showOnboardingDialog(context, ref)),

      SettingsProfileCard(
        onTap: () => pushSettingsPage(context, const IdentityScreen()),
      ),

      _NutritionProfileGroup(profile: profile),

      // ── Preferences ─────────────────────────────────────────────────────
      // Hidden until the profile loads (web parity) — an enabled switch with
      // no profile row can only produce an error.
      if (profile != null)
        SettingsGroup(
          label: tr('settings.preferences'),
          children: [
            AutoShareToCircleToggle(value: profile.autoShareToCircle),
            const AiConsentToggle(),
          ],
        ),

      if (showSubscription) const SubscriptionSection(),

      const AccountSection(),

      // ── About — legal and the feedback row ─────────────────────────────
      // It sits between the delete-account row and sign out, which is what
      // keeps the session action people reach for by habit from stacking
      // against the irreversible one.
      const AboutSection(),

      // ── Sign out — the last card on the screen ─────────────────────────
      const GroupedListCard(children: [SignOutRow()]),

      // The build's identity, quiet and unadorned under everything else.
      Center(
        child: Text(
          '${tr('settings.about.version')} $kAppVersion',
          style: dashMeta(),
        ),
      ),
    ];

    return Screen(
      bottom: false,
      child: ScrollSeparator(
        header: PageHeader(
          title: tr('settings.title'),
          // The root's back leaves settings entirely, so it pops the ROUTER,
          // not the nested navigator.
          onBack: () => GoRouter.of(context).pop(),
        ),
        child: ListView.separated(
          padding: SettingsSpacing.rowList(context),
          itemCount: items.length,
          itemBuilder: (_, i) => items[i],
          separatorBuilder:
              (_, __) => const SizedBox(height: SettingsSpacing.group),
        ),
      ),
    );
  }
}

/// "Hồ sơ dinh dưỡng" — one row per onboarding step, in the order onboarding
/// asks them, each subline the answers its page holds (or what is missing).
///
/// Body metrics got their own row (2026-09-24): they used to live inside
/// "Mục tiêu & tốc độ", and nothing on the root said so — the most-edited
/// fields in the profile were the hardest to find.
class _NutritionProfileGroup extends StatelessWidget {
  const _NutritionProfileGroup({required this.profile});

  final ProfileRow? profile;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.languageCode;
    return SettingsGroup(
      label: tr('settings.groups.nutritionProfile'),
      children: [
        ListRow(
          icon: LucideIcons.user300,
          label: tr('settings.rows.aboutYou'),
          subline: ProfileSummaries.aboutYou(profile, locale),
          showChevron: true,
          onTap: () => pushSettingsPage(context, const AboutYouPage()),
        ),
        ListRow(
          icon: LucideIcons.target300,
          label: tr('settings.rows.goalPace'),
          subline: ProfileSummaries.goal(profile, locale),
          showChevron: true,
          onTap: () => pushSettingsPage(context, const GoalPacePage()),
        ),
        ListRow(
          icon: LucideIcons.utensilsCrossed300,
          label: tr('settings.rows.cooking'),
          subline: ProfileSummaries.cooking(profile),
          showChevron: true,
          onTap: () => pushSettingsPage(context, const CookingPage()),
        ),
        ListRow(
          icon: LucideIcons.globe300,
          label: tr('settings.rows.region'),
          subline: ProfileSummaries.region(profile, locale),
          showChevron: true,
          onTap: () => pushSettingsPage(context, const RegionPage()),
        ),
      ],
    );
  }
}
