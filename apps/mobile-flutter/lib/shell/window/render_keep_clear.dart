import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/widgets.dart' show ScrollPosition;

import 'keep_clear.dart';
import 'keep_clear_root.dart';

/// What [KeepClear] lays out: its child, inset by however far it has to give
/// way, measured after each frame it lays out or paints in.
class RenderKeepClear extends RenderShiftedBox {
  RenderKeepClear({
    required KeepClearMode mode,
    required List<Rect> zones,
    ScrollPosition? scroll,
  }) : _mode = mode,
       _zones = zones,
       _scroll = scroll,
       super(null);

  /// The largest gap a piece keeps from the column: a page's side margin.
  static const double maxGap = 24;

  EdgeInsets _inset = EdgeInsets.zero;

  KeepClearMode _mode;
  set mode(KeepClearMode value) {
    if (value == _mode) return;
    _mode = value;
    _measure();
  }

  List<Rect> _zones;
  set zones(List<Rect> value) {
    if (listEquals(value, _zones)) return;
    _zones = value;
    _measure();
  }

  ScrollPosition? _scroll;
  set scroll(ScrollPosition? value) => _scroll = value;

  @override
  void performLayout() {
    final child = this.child;
    if (child == null) {
      size = constraints.smallest;
      return;
    }
    child.layout(constraints.deflate(_inset), parentUsesSize: true);
    (child.parentData! as BoxParentData).offset = _inset.topLeft;
    size = constraints.constrain(_inset.inflateSize(child.size));
    _measure();
  }

  @override
  Size computeDryLayout(BoxConstraints constraints) {
    final child = this.child;
    if (child == null) return constraints.smallest;
    return constraints.constrain(
      _inset.inflateSize(child.getDryLayout(constraints.deflate(_inset))),
    );
  }

  @override
  double computeMinIntrinsicWidth(double height) =>
      (child?.getMinIntrinsicWidth(height) ?? 0) + _inset.horizontal;

  @override
  double computeMaxIntrinsicWidth(double height) =>
      (child?.getMaxIntrinsicWidth(height) ?? 0) + _inset.horizontal;

  @override
  double computeMinIntrinsicHeight(double width) =>
      (child?.getMinIntrinsicHeight(math.max(0, width - _inset.horizontal)) ??
          0) +
      _inset.vertical;

  @override
  double computeMaxIntrinsicHeight(double width) =>
      (child?.getMaxIntrinsicHeight(math.max(0, width - _inset.horizontal)) ??
          0) +
      _inset.vertical;

  @override
  void paint(PaintingContext context, Offset offset) {
    super.paint(context, offset);
    // A piece can move without being laid out again (a sibling above it
    // grew), and then only paints.
    _measure();
  }

  bool _pending = false;

  void _measure() {
    if (_pending || (_zones.isEmpty && _inset == EdgeInsets.zero)) return;
    _pending = true;
    SchedulerBinding.instance.addPostFrameCallback((_) {
      _pending = false;
      if (!attached || !hasSize) return;
      final wanted = _wanted();
      final moved =
          (wanted.left - _inset.left).abs() > .25 ||
          (wanted.right - _inset.right).abs() > .25 ||
          (wanted.top - _inset.top).abs() > .25;
      if (!moved) return;
      _inset = wanted;
      markNeedsLayout();
    });
  }

  EdgeInsets _wanted() {
    final root = RenderKeepClearRoot.above(this);
    if (root == null || _zones.isEmpty) return EdgeInsets.zero;
    var box = MatrixUtils.transformRect(
      _restingTransform(root),
      Offset.zero & size,
    );
    final scroll = _scroll;
    if (scroll != null &&
        scroll.hasPixels &&
        scroll.axisDirection == AxisDirection.down) {
      box = box.translate(0, scroll.pixels);
    }
    final width = root.size.width;
    var left = 0.0, right = 0.0, top = 0.0;
    for (final zone in _zones) {
      final atTop = zone.top <= 0;
      // A pushed-down piece is measured from where it would start unpushed.
      final start = box.top;
      if (atTop ? start >= zone.bottom : box.bottom <= zone.top) continue;
      final columnLeft = zone.left <= 0;
      final reach = columnLeft ? zone.right - box.left : box.right - zone.left;
      if (reach <= 0) continue;
      if (_mode == KeepClearMode.below) {
        if (atTop) top = math.max(top, zone.bottom - start);
        continue;
      }
      final margin = columnLeft ? box.left : width - box.right;
      final give = reach + margin.clamp(0, maxGap);
      if (_mode == KeepClearMode.side) {
        if (columnLeft) {
          left = math.max(left, give);
        } else {
          right = math.max(right, give);
        }
      } else {
        left = math.max(left, give);
        right = math.max(right, give);
      }
    }
    return EdgeInsets.fromLTRB(left, top, right, 0);
  }

  /// [getTransformTo] the page, less any slide a transition is playing on
  /// the way (a wizard step sliding in): a piece is measured where it comes
  /// to rest, so it does not re-wrap as it slides.
  Matrix4 _restingTransform(RenderKeepClearRoot root) {
    final chain = <RenderObject>[this];
    for (var node = parent; node != null && node != root; node = node.parent) {
      chain.add(node);
    }
    chain.add(root);
    final transform = Matrix4.identity();
    for (var i = chain.length - 1; i > 0; i--) {
      if (chain[i] is RenderFractionalTranslation) continue;
      chain[i].applyPaintTransform(chain[i - 1], transform);
    }
    return transform;
  }
}
