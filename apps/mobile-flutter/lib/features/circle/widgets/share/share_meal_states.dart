import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/data/surface_cast.dart';
import '../../../../shared/widgets/feedback/kallo_surface_state.dart';
import '../../../../shared/widgets/surface/kallo_primitives.dart';

/// The share sheet's async surfaces.
///
/// Both go through `KalloSurfaceState`, which is the app's ONE state surface —
/// illustration, title, one supporting line, one action. The share flow was the
/// only feature that never adopted it and hand-rolled bare `Text` instead.
///
/// Note the retry is the black `cta`, not danger: per `circle_error.dart`,
/// "a retry is not a destruction". There is no red on either of these.

/// A failed fetch. Must never be mistaken for "you have no friends".
class ShareMealErrorState extends StatelessWidget {
  const ShareMealErrorState({super.key, required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return KalloSurfaceState(
      area: SurfaceArea.circle,
      kind: SurfaceKind.error,
      compact: true,
      title: tr('groups.error.title'),
      subtitle: tr('groups.error.body'),
      action: KalloButton(
        variant: KalloButtonVariant.cta,
        title: tr('groups.error.retry'),
        onPressed: onRetry,
      ),
    );
  }
}

/// No circle yet — the one state that must not be a dead end.
class ShareMealEmptyState extends StatelessWidget {
  const ShareMealEmptyState({super.key, required this.onAddFriends});

  final VoidCallback onAddFriends;

  @override
  Widget build(BuildContext context) {
    return KalloSurfaceState(
      area: SurfaceArea.circle,
      kind: SurfaceKind.empty,
      compact: true,
      title: tr('groups.shareMeal.emptyTitle'),
      subtitle: tr('groups.shareMeal.emptyBody'),
      action: KalloButton(
        variant: KalloButtonVariant.cta,
        title: tr('groups.shareMeal.addFriends'),
        onPressed: onAddFriends,
      ),
    );
  }
}
