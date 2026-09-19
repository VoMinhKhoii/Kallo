import 'package:flutter/widgets.dart';

import 'kallo_theme.dart';

/// The app's corner geometry: squircles, and the two places that are not.
///
/// A `BorderRadius.circular` corner is a quarter-circle spliced onto a
/// straight edge, so curvature jumps from zero to constant at the splice. Apple
/// has not drawn corners that way since iOS 7 — a home-screen icon, a grouped
/// card, a sheet and an alert are all **rounded superellipses**, where
/// curvature ramps in. At 22pt the difference is small per corner and
/// unmistakable across a screen of stacked cards: the circular version reads
/// very slightly pinched at each corner.
///
/// Flutter 3.44 ships this natively as [RoundedSuperellipseBorder] and
/// [ClipRSuperellipse]; the Cupertino sheet route and the sliding segmented
/// control already draw themselves this way. This file is how the app's own
/// surfaces join them.
///
/// **Where squircles do NOT apply**, because Apple does not use them there
/// either:
///
///  * **Capsules** — a pill button, a chip, the nav capsule. When the radius is
///    half the height the shape is a stadium, whose ends are true semicircles.
///    A superellipse of a capsule is a subtly wrong capsule. Keep
///    [KalloRadii.pill] on `BorderRadius.circular` / `StadiumBorder`.
///  * **Circles** — avatars, the grabber, status dots. A squircle of a circle
///    is a squircle, not a circle.
///
/// The rule of thumb is the ratio: squircle when the radius is a fraction of
/// the shorter side, circular when it IS the shorter side.
abstract final class KalloShapes {
  /// A squircle border at [radius], for [ShapeDecoration.shape] and anything
  /// else taking a [ShapeBorder].
  static RoundedSuperellipseBorder squircle(
    double radius, {
    BorderSide side = BorderSide.none,
  }) => RoundedSuperellipseBorder(
    borderRadius: BorderRadius.circular(radius),
    side: side,
  );

  /// A squircle rounded on the TOP corners only — the sheet surface.
  static RoundedSuperellipseBorder squircleTop(
    double radius, {
    BorderSide side = BorderSide.none,
  }) => RoundedSuperellipseBorder(
    borderRadius: BorderRadius.vertical(top: Radius.circular(radius)),
    side: side,
  );
}
