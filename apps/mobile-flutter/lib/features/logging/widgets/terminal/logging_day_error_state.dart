import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/data/surface_cast.dart';
import '../../../../shared/widgets/feedback/kallo_surface_state.dart';
import '../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../theme/kallo_theme.dart';

/// The logging feed when a day will not load: the tangled otter, the reason,
/// and one retry. No red — retrying a fetch is not a destruction, so the
/// affordance is the black `cta` every surface state gives its one action,
/// the one sanctioned use of that tier outside auth and the paywall.
class LoggingDayErrorState extends StatelessWidget {
  const LoggingDayErrorState({super.key, required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(KalloSpacing.sp6),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 448), // max-w-md
          child: KalloSurfaceState(
            area: SurfaceArea.logging,
            kind: SurfaceKind.error,
            title: tr('logging.feedArea.loadErrorTitle'),
            subtitle: tr('logging.feedArea.loadErrorDescription'),
            action: KalloButton(
              variant: KalloButtonVariant.cta,
              title: tr('logging.feedArea.retryDay'),
              onPressed: onRetry,
            ),
          ),
        ),
      ),
    );
  }
}
