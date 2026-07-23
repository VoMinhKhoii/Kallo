import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';

/// Empty state when no profile exists yet (onboarding never ran).
class ProfileEmpty extends StatelessWidget {
  const ProfileEmpty({super.key});

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
                    style: dashBody(
                      weight: FontWeight.w500,
                      color: Colors.white,
                    ),
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
class ProfileLoadError extends StatelessWidget {
  const ProfileLoadError({super.key, required this.onRetry});

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
                    style: dashBody(
                      weight: FontWeight.w500,
                      color: Colors.white,
                    ),
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
