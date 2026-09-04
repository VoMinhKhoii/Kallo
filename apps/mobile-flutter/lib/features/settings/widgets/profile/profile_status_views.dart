import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/data/surface_cast.dart';
import '../../../../shared/widgets/feedback/kallo_surface_state.dart';
import '../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../shell/nav/nav_actions.dart';

/// Empty state when no profile exists yet (onboarding never ran).
///
/// Both states here now wear the playful treatment the native pass deferred:
/// the shared [KalloSurfaceState] with the system seal — holding a map when
/// there is nowhere to go yet, sweeping up when the fetch failed. Their
/// actions stay ordinary in-app primaries (beige), not the black CTA reserved
/// for auth and the paywall.
class ProfileEmpty extends StatelessWidget {
  const ProfileEmpty({super.key});

  @override
  Widget build(BuildContext context) {
    return KalloSurfaceState(
      area: SurfaceArea.system,
      kind: SurfaceKind.empty,
      title: tr('settings.profilePage.emptyTitle'),
      subtitle: tr('settings.profilePage.emptyDescription'),
      // RN routes "Start setup" to /logging (where the onboarding overlay
      // resumes). go_router resolves via the root navigator from any
      // descendant context, so this crosses tabs correctly.
      action: KalloButton(
        title: tr('settings.profilePage.startSetup'),
        onPressed: () => goToLogging(context),
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
    return KalloSurfaceState(
      area: SurfaceArea.system,
      kind: SurfaceKind.error,
      title: tr('common.error'),
      subtitle: tr('errors.route.body'),
      action: KalloButton(
        title: tr('common.retry'),
        onPressed: onRetry,
      ),
    );
  }
}
