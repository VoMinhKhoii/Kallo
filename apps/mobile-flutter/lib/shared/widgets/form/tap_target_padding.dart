import 'dart:math' as math;

import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';

/// Grows the TARGET to [minSize] without growing the child, and sends a touch
/// anywhere inside it to the child's own hit test.
///
/// Its own file because it is a different concern from the switch that needed
/// it — a hit-testing primitive against a themed control — and because the two
/// together crossed the 200-line ceiling. `KalloSwitch` is its only consumer
/// today; the comments below are the reason it is not simply a `ConstrainedBox`,
/// and every one of them is a defect this file shipped first.
///
/// `CupertinoSwitch` renders at 59x39 (`_kSwitchSize`, cupertino/switch.dart)
/// — 5pt under the app's 44pt floor. `Switch.adaptive` used to hide that:
/// Material wraps its switch in exactly this, `_RenderInputPadding`
/// (`material/button_style_button.dart`), and taking the Cupertino widget
/// directly gave it up. This is that mechanism, not an approximation of it.
///
/// A `ConstrainedBox` around a `Center` was the first attempt and was only
/// half a fix: it laid out to 44 and a size assertion was satisfied, but
/// neither render object claims a hit, so the band fell through to nothing.
/// The second attempt wrapped an opaque `GestureDetector` that forwarded
/// `onTap` by hand — which cured taps and left DRAGS dead, because the switch
/// cannot join a gesture arena it was never hit-tested into, and a hand-rolled
/// tap forwarder cancels the moment the finger travels past slop. Redirecting
/// the hit is the only version where the platform's own recognisers — tap and
/// horizontal drag alike — get the pointer, so nothing about the switch's
/// behaviour is reimplemented here.
///
/// The redirect is a TRANSLATION to the nearest point inside the child, not
/// Material's `MatrixUtils.forceToPoint(centre)`. That distinction is the
/// whole reason drags work here and do not in Material's version: a
/// force-to-point transform maps every position to one point, so
/// `PointerMoveEvent.localDelta` is zero for the entire gesture and
/// `DragUpdateDetails.primaryDelta` never moves `_dragDelta`
/// (`cupertino/switch.dart:603`). The recogniser joins the arena, wins it,
/// and reports a drag that never travels. A translation carries the deltas
/// through untouched.
///
class TapTargetPadding extends SingleChildRenderObjectWidget {
  const TapTargetPadding({
    super.key,
    required this.minSize,
    required super.child,
  });

  final Size minSize;

  @override
  RenderTapTargetPadding createRenderObject(BuildContext context) =>
      RenderTapTargetPadding(minSize);

  @override
  void updateRenderObject(
    BuildContext context,
    RenderTapTargetPadding renderObject,
  ) {
    renderObject.minSize = minSize;
  }
}

class RenderTapTargetPadding extends RenderShiftedBox {
  RenderTapTargetPadding(this._minSize) : super(null);

  Size get minSize => _minSize;
  Size _minSize;
  set minSize(Size value) {
    if (_minSize == value) return;
    _minSize = value;
    markNeedsLayout();
  }

  Size _sizeFor(BoxConstraints constraints, ChildLayouter layoutChild) {
    final child = this.child;
    if (child == null) return Size.zero;
    final Size childSize = layoutChild(child, constraints);
    return constraints.constrain(
      Size(
        math.max(childSize.width, minSize.width),
        math.max(childSize.height, minSize.height),
      ),
    );
  }

  // The four intrinsics, because `RenderShiftedBox` delegates every one of
  // them straight to the child (`rendering/shifted_box.dart:38-56`) and
  // `computeDryLayout` does not cover them. Under an `IntrinsicHeight` the
  // wrapper would report the switch's 39, the parent would hand back a tight
  // 39, and `constraints.constrain` would collapse the 44 target to 39 — the
  // floor silently undone by a layout widget, which is exactly how it was lost
  // the first time.
  double _atLeast(double childValue, double floor) =>
      math.max(childValue, floor);

  @override
  double computeMinIntrinsicWidth(double height) =>
      _atLeast(child?.getMinIntrinsicWidth(height) ?? 0, minSize.width);

  @override
  double computeMaxIntrinsicWidth(double height) =>
      _atLeast(child?.getMaxIntrinsicWidth(height) ?? 0, minSize.width);

  @override
  double computeMinIntrinsicHeight(double width) =>
      _atLeast(child?.getMinIntrinsicHeight(width) ?? 0, minSize.height);

  @override
  double computeMaxIntrinsicHeight(double width) =>
      _atLeast(child?.getMaxIntrinsicHeight(width) ?? 0, minSize.height);

  @override
  Size computeDryLayout(BoxConstraints constraints) =>
      _sizeFor(constraints, ChildLayoutHelper.dryLayoutChild);

  @override
  void performLayout() {
    size = _sizeFor(constraints, ChildLayoutHelper.layoutChild);
    final child = this.child;
    if (child == null) return;
    (child.parentData! as BoxParentData).offset = Alignment.center.alongOffset(
      size - child.size as Offset,
    );
  }

  /// `Size.contains` is half-open on the far edges (`dy < height`), so a point
  /// landed exactly on them would not count as a hit.
  static const double _justInside = 0.01;

  @override
  bool hitTest(BoxHitTestResult result, {required Offset position}) {
    // Out of our own bounds, decline — BEFORE anything else. `RenderFlex` hands
    // every child the row-local position and relies on the child to reject
    // what is not its own (`defaultHitTestChildren`), and trailing children are
    // tested first. Without this line the clamp below took a tap on the row's
    // LABEL, dragged it into the switch, and flipped the setting. `super`
    // already makes this check internally, but it reports the failure by
    // returning false — which is indistinguishable here from "inside the box,
    // in the band", the one case the redirect exists for.
    if (!size.contains(position)) return false;

    // The child first, at its real position, so a touch on the track behaves
    // exactly as it always did. Only the band falls through to the redirect.
    if (super.hitTest(result, position: position)) return true;
    final child = this.child;
    if (child == null) return false;

    final Offset childOffset = (child.parentData! as BoxParentData).offset;
    final Offset local = position - childOffset;
    final Offset inside = Offset(
      local.dx.clamp(0.0, math.max(0.0, child.size.width - _justInside)),
      local.dy.clamp(0.0, math.max(0.0, child.size.height - _justInside)),
    );

    // Offsetting by the shortfall as well as the child's own position is what
    // keeps this a translation: the child is entered at the edge the finger
    // came from, and every later move arrives with its true delta.
    return result.addWithPaintOffset(
      offset: childOffset + (local - inside),
      position: position,
      hitTest:
          (result, transformed) => child.hitTest(result, position: transformed),
    );
  }
}
