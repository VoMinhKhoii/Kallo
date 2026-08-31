import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../../theme/kallo_typography.dart';
import '../../../../shell/nav/nav_actions.dart';

/// Empty state when no profile exists yet (onboarding never ran).
///
/// Both states here are placeholders for the playful empty/error treatment
/// that is DEFERRED out of the native pass (the spot icons are unreachable);
/// what they did take from it is the button system — their actions are
/// ordinary in-app primaries (beige), not the black CTA now reserved for auth
/// and the paywall.
class ProfileEmpty extends StatelessWidget {
  const ProfileEmpty({super.key});

  @override
  Widget build(BuildContext context) {
    return _Status(
      title: tr('settings.profilePage.emptyTitle'),
      body: tr('settings.profilePage.emptyDescription'),
      // RN routes "Start setup" to /logging (where the onboarding overlay
      // resumes). go_router resolves via the root navigator from any
      // descendant context, so this crosses tabs correctly.
      action: tr('settings.profilePage.startSetup'),
      onAction: () => landInLogging(context),
    );
  }
}

/// Profile load failed (a flaky fetch, not an absent profile). Shows a neutral
/// error + a retry — never the re-onboarding "Start setup" CTA, which would
/// strand a configured user in a false "set up your profile" dead-end.
class ProfileLoadError extends StatelessWidget {
  const ProfileLoadError({super.key, required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return _Status(
      title: tr('common.error'),
      action: tr('common.retry'),
      onAction: onRetry,
    );
  }
}

/// The shared shape: a serif line, an optional reason, ONE action.
class _Status extends StatelessWidget {
  const _Status({
    required this.title,
    this.body,
    required this.action,
    required this.onAction,
  });

  final String title;
  final String? body;
  final String action;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp5),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: KalloTextStyles.serifRegular(
              fontSize: KalloFontSize.h3,
            ).copyWith(
              letterSpacing: KalloTracking.tight,
              color: KalloColors.text,
            ),
          ),
          if (body != null) ...[
            const SizedBox(height: KalloSpacing.sp4),
            Text(body!, style: dashBody(color: kInkMuted)),
          ],
          const SizedBox(height: KalloSpacing.sp4),
          Align(
            alignment: Alignment.centerLeft,
            child: KalloButton(title: action, onPressed: onAction),
          ),
        ],
      ),
    );
  }
}
