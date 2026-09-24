import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/data/surface_cast.dart';
import '../../../../shared/widgets/feedback/kallo_surface_state.dart';
import '../../../../shared/widgets/surface/kallo_primitives.dart';

/// The profile fetch failed on a Settings step page.
///
/// There is no "empty" counterpart any more: a profile that was never filled
/// in opens its step page on onboarding's neutral answers, so it can be set up
/// right there — sending that user off to "Start setup" was the dead end.
///
/// A flaky fetch, not an absent profile, so it shows a neutral
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
        variant: KalloButtonVariant.cta,
        title: tr('common.retry'),
        onPressed: onRetry,
      ),
    );
  }
}
