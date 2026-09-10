import 'package:flutter/widgets.dart';

/// The shared POLICY behind the app's two back-swipes: how hard a flick has to
/// be to count, and which way "back" points.
///
/// The two gestures are deliberately different MECHANISMS — the route-level
/// one (`swipe_back_detector.dart`) drives a route animation 1:1, while the
/// onboarding one (`onboarding_step_swipe.dart`) commits a discrete step
/// against an `AnimatedSwitcher` it cannot drive — and merging them would be
/// wrong. But "how hard did the user flick" is the same question in both, and
/// it had been answered twice in incompatible UNITS: 1 screen-width per second
/// at the route level, 400 raw pixels per second in the wizard. Those are the
/// same bar on a 393pt iPhone and wildly different ones anywhere else — on a
/// 1024pt iPad the wizard fired at under 40% of the intent the route needed,
/// one widget apart, on the same finger.
abstract final class BackSwipe {
  /// Screen widths per second past which the release is a flick and the
  /// direction of travel decides, rather than how far the finger got.
  ///
  /// Cupertino's own value. Deliberately far above Flutter's
  /// `kMinFlingVelocity` (50 px/s), which is a "did it move at all" floor: at
  /// that bar a lazy horizontal wobble during a vertical scroll commits.
  static const double minFlingWidthsPerSecond = 1;

  /// Fraction of the width a SLOW drag must cover to commit instead.
  static const double commitFraction = 0.5;

  /// Whether [dxPerSecond] (already signed so that positive means "toward
  /// back") over a region [width] wide is a flick. False for a zero-width
  /// region, which is a box that has not been laid out yet.
  static bool isFling(double dxPerSecond, double width) =>
      width > 0 && dxPerSecond / width >= minFlingWidthsPerSecond;

  /// +1 when a rightward drag means back, -1 under RTL — so a caller can
  /// multiply a raw delta once and reason in "toward back" from then on.
  static double backSign(BuildContext context) =>
      Directionality.of(context) == TextDirection.rtl ? -1 : 1;
}
