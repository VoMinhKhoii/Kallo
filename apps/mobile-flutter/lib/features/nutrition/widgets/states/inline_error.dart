import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/data/surface_cast.dart';
import '../../../../shared/widgets/feedback/kallo_surface_state.dart';
import '../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';

/// The nutrition page when the overview will not load: the tangled sloth, what
/// went wrong in muted copy, and the one way out.
///
/// There is no red on this card. A retry is not a destruction, so the
/// affordance takes the app's in-app primary (beige + ink, fully rounded)
/// rather than anything alarming. The card itself is the page's own card:
/// white, radius 22, no border.
class InlineError extends StatelessWidget {
  const InlineError({
    super.key,
    required this.isRetrying,
    required this.message,
    required this.onRetry,
    required this.retryLabel,
  });

  final bool isRetrying;
  final String message;
  final VoidCallback onRetry;
  final String retryLabel;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: KalloSpacing.sp4,
        vertical: KalloSpacing.sp3,
      ),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(kCardRadius),
        color: kCardSurface,
      ),
      child: KalloSurfaceState(
        area: SurfaceArea.nutrition,
        kind: SurfaceKind.error,
        title: tr('nutrition.errors.overviewTitle'),
        subtitle: message,
        action: KalloButton(
          title: retryLabel,
          loading: isRetrying,
          onPressed: onRetry,
        ),
      ),
    );
  }
}
