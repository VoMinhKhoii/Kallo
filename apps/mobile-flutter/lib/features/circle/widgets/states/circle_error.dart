import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/data/surface_cast.dart';
import '../../../../shared/widgets/feedback/kallo_surface_state.dart';
import '../../../../shared/widgets/surface/kallo_primitives.dart';

/// Retryable error state for the Circle read surfaces (wall, circle list,
/// invite preview). A failed fetch must not masquerade as an empty state — a
/// user with a circle should see "try again", not "your circle is quiet".
///
/// The shared surface anatomy: the capybara stuck in a jar, the reason, and
/// one retry. There is no red here — a retry is not a destruction, so the
/// affordance is the ordinary in-app primary (beige + ink).
class CircleErrorCard extends StatelessWidget {
  const CircleErrorCard({
    required this.onRetry,
    this.isRetrying = false,
    this.compact = false,
    super.key,
  });

  final VoidCallback onRetry;
  final bool isRetrying;

  /// In-card sizing, for the sheets and lists that host this inside a section
  /// rather than handing it the surface.
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return KalloSurfaceState(
      area: SurfaceArea.circle,
      kind: SurfaceKind.error,
      compact: compact,
      title: tr('groups.error.title'),
      subtitle: tr('groups.error.body'),
      action: KalloButton(
        title: tr('groups.error.retry'),
        loading: isRetrying,
        onPressed: onRetry,
      ),
    );
  }
}
