import 'dart:math' as math;

import 'package:flutter/cupertino.dart';
import 'package:flutter/rendering.dart';

import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';

/// The app's one switch — umber when on, iOS geometry and feel throughout.
///
/// [CupertinoSwitch] directly, not `Switch.adaptive`. The adaptive switch got
/// the right shape on iOS but needed a workaround to get the right colour:
/// `ThemeData.switchTheme` never reaches it, because Flutter's
/// `_SwitchThemeAdaptation.adapt()` returns a bare `const SwitchThemeData()`
/// on iOS and macOS (`material/switch.dart`), so a theme would quietly fix
/// Android and leave iOS on the Cupertino default green. That forced a
/// widget-level `trackColor` resolver whose only job was to be the one entry
/// in the fallback chain that lands. [CupertinoSwitch.activeTrackColor] is
/// simply the colour, and the resolver is gone.
///
/// The thumb's press behaviour comes with it rather than being rebuilt: the
/// thumb stretches while a finger is down (`_kThumbExtensionFactor = 7.0` in
/// `cupertino/switch.dart`) and settles on release. That is the expand the
/// hand-rolled controls in this app imitate by hand, here for free and at the
/// platform's own timing.
///
/// Umber ([KalloColors.btn]) is web parity: the shadcn switch there is
/// `data-[state=checked]:bg-primary`, and `--primary` is `--kallo-btn`.
class KalloSwitch extends StatelessWidget {
  const KalloSwitch({
    super.key,
    required this.value,
    required this.onChanged,
    this.semanticLabel,
  });

  final bool value;

  /// Null disables the switch (an update in flight, a gated preference).
  final ValueChanged<bool>? onChanged;

  /// Names the control for screen readers when the surrounding row provides no
  /// toggle semantics of its own — without it a bare on/off state is announced.
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    // Only the ON track is themed. Leaving `inactiveTrackColor` alone keeps the
    // platform's own off state, which is what the `trackColor` resolver was
    // doing by resolving to null while unselected.
    final switchWidget = _TapTargetPadding(
      minSize: const Size.square(KalloIcons.hit),
      child: CupertinoSwitch(
        value: value,
        onChanged: onChanged,
        activeTrackColor: KalloColors.btn,
      ),
    );

    if (semanticLabel == null) return switchWidget;
    return Semantics(label: semanticLabel, child: switchWidget);
  }
}

/// Grows the TARGET to [minSize] without growing the child, and sends a touch
/// anywhere inside it to the child's own hit test.
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
class _TapTargetPadding extends SingleChildRenderObjectWidget {
  const _TapTargetPadding({required this.minSize, required super.child});

  final Size minSize;

  @override
  _RenderTapTargetPadding createRenderObject(BuildContext context) =>
      _RenderTapTargetPadding(minSize);

  @override
  void updateRenderObject(
    BuildContext context,
    _RenderTapTargetPadding renderObject,
  ) {
    renderObject.minSize = minSize;
  }
}

class _RenderTapTargetPadding extends RenderShiftedBox {
  _RenderTapTargetPadding(this._minSize) : super(null);

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
