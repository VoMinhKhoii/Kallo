import 'package:flutter/material.dart';

import '../../../theme/kallo_colors.dart';

/// The app's one pull-to-refresh.
///
/// `RefreshIndicator.adaptive`, so each platform gets the indicator its users
/// already know: the Cupertino spinner on iOS, the Material circle on Android.
/// The three scrollable surfaces used to disagree — one adaptive, two forced to
/// Material, one of those over `BouncingScrollPhysics`, which put an Android
/// spinner on top of an iOS bounce. Use this instead of `RefreshIndicator`
/// directly so they cannot drift apart again.
class KalloRefresh extends StatelessWidget {
  const KalloRefresh({
    super.key,
    required this.onRefresh,
    required this.child,
  });

  final Future<void> Function() onRefresh;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator.adaptive(
      onRefresh: onRefresh,
      // Ink, not `accent`: the tan is ~2.24:1 on a light surface, which is
      // under the bar for a standalone mark. Ignored by the Cupertino
      // variant, which draws its own spinner.
      color: KalloColors.text,
      backgroundColor: KalloColors.elev,
      child: child,
    );
  }
}
