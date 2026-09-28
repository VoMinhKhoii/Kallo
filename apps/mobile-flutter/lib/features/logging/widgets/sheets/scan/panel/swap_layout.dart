import 'dart:ui' show lerpDouble;

import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';

/// Lays out the sheet's pages during a swap: each at the sheet's full width
/// and its OWN height, pinned to the top, the whole clipped to one height that
/// runs from the outgoing page's to the incoming one's as [t] runs 0 → 1.
/// With one child it is simply that child's height.
///
/// **Why not `AnimatedSize`.** It chases every change of its child's size, and
/// a page's height changes every frame the keyboard moves: the sheet would
/// trail the keyboard by a whole animation, its field hidden behind the keys.
/// Here the height blends only while a swap runs; otherwise it is the page's,
/// frame for frame. (`SheetPageSwap` re-keys its `AnimatedSize` instead, at
/// the cost of both pages' state — a typed draft or a focused field.)
class ScanSwapLayout extends MultiChildRenderObjectWidget {
  /// [children] is `[outgoing, incoming]` during a swap, else `[page]`.
  const ScanSwapLayout({super.key, required this.t, required super.children});

  final double t;

  @override
  RenderObject createRenderObject(BuildContext context) =>
      RenderScanSwapLayout(t);

  @override
  void updateRenderObject(
    BuildContext context,
    RenderScanSwapLayout renderObject,
  ) => renderObject.t = t;
}

class _SwapParentData extends ContainerBoxParentData<RenderBox> {}

/// [ScanSwapLayout]'s render object; public only so the widget may name it.
class RenderScanSwapLayout extends RenderBox
    with
        ContainerRenderObjectMixin<RenderBox, _SwapParentData>,
        RenderBoxContainerDefaultsMixin<RenderBox, _SwapParentData> {
  RenderScanSwapLayout(this._t);

  double _t;
  set t(double value) {
    if (value == _t) return;
    _t = value;
    markNeedsLayout();
  }

  final LayerHandle<ClipRectLayer> _clip = LayerHandle<ClipRectLayer>();

  @override
  void setupParentData(RenderBox child) {
    if (child.parentData is! _SwapParentData) {
      child.parentData = _SwapParentData();
    }
  }

  @override
  void performLayout() {
    final width = constraints.maxWidth;
    final pageConstraints = BoxConstraints(
      minWidth: width,
      maxWidth: width,
      maxHeight: constraints.maxHeight,
    );
    final heights = <double>[];
    var child = firstChild;
    while (child != null) {
      child.layout(pageConstraints, parentUsesSize: true);
      heights.add(child.size.height);
      child = childAfter(child);
    }
    final height = switch (heights) {
      [] => 0.0,
      [final only] => only,
      [final from, final to, ...] => lerpDouble(from, to, _t)!,
    };
    size = constraints.constrain(Size(width, height));
  }

  @override
  bool hitTestChildren(BoxHitTestResult result, {required Offset position}) =>
      defaultHitTestChildren(result, position: position);

  @override
  void paint(PaintingContext context, Offset offset) {
    _clip.layer = context.pushClipRect(
      needsCompositing,
      offset,
      Offset.zero & size,
      defaultPaint,
      oldLayer: _clip.layer,
    );
  }

  @override
  void dispose() {
    _clip.layer = null;
    super.dispose();
  }
}
