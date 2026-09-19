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

  /// The app's card: squircle at [KalloRadii.card], no border, no shadow.
  ///
  /// [ShapeDecoration] rather than [BoxDecoration] because only the former
  /// takes a [ShapeBorder]; note it spells shadows `shadows`, not `boxShadow`,
  /// and takes the border through the shape's `side` rather than a `border`.
  static ShapeDecoration card({
    required Color color,
    double radius = KalloRadii.card,
    BorderSide side = BorderSide.none,
    List<BoxShadow> shadows = const [],
  }) => ShapeDecoration(
    color: color,
    shape: squircle(radius, side: side),
    shadows: shadows,
  );
}

/// Clips [child] to a squircle — the [ClipRRect] of this file.
///
/// Use where content must be cut to the corner (an image, a camera frame, a
/// list section whose rows paint their own background to the edge). Where the
/// surface merely paints a rounded fill, [KalloShapes.card] is cheaper: it has
/// no clip layer at all.
class KalloSquircle extends StatelessWidget {
  const KalloSquircle({
    super.key,
    required this.child,
    this.radius = KalloRadii.card,
    this.clipBehavior = Clip.antiAlias,
  });

  final Widget child;
  final double radius;
  final Clip clipBehavior;

  @override
  Widget build(BuildContext context) => ClipRSuperellipse(
    borderRadius: BorderRadius.circular(radius),
    clipBehavior: clipBehavior,
    child: child,
  );
}
