import 'package:flutter/foundation.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';

import 'keep_clear_root.dart';
import 'keep_clear_zones.dart';

/// Hides a scroll view's content inside the keep-clear corners of a
/// column-free page, so nothing scrolls under the status items or the
/// camera: in the column's strip the viewport starts below the top corner
/// (or, on an outer display turned with the column on the right, ends above
/// the camera's corner at the bottom).
///
/// At rest the page keeps its pieces out of the corners itself
/// ([KeepClear]); this only covers what scrolling brings into them. Off a
/// column-free page, and wherever the scroll view does not reach a corner, it
/// paints its child unclipped.
class KeepClearClip extends SingleChildRenderObjectWidget {
  const KeepClearClip({super.key, required Widget super.child});

  @override
  RenderKeepClearClip createRenderObject(BuildContext context) =>
      RenderKeepClearClip(keepClearZones(context));

  @override
  void updateRenderObject(
    BuildContext context,
    RenderKeepClearClip renderObject,
  ) => renderObject.zones = keepClearZones(context);
}

class RenderKeepClearClip extends RenderProxyBox {
  RenderKeepClearClip(this._zones);

  List<Rect> _zones;
  set zones(List<Rect> value) {
    if (listEquals(value, _zones)) return;
    _zones = value;
    markNeedsPaint();
  }

  final _clip = LayerHandle<ClipPathLayer>();

  /// The corners in this box's own coordinates, where they overlap it.
  List<Rect> get holes {
    final root = RenderKeepClearRoot.above(this);
    if (root == null || _zones.isEmpty || !hasSize) return const [];
    final toRoot = getTransformTo(root);
    final bounds = Offset.zero & size;
    return [
      for (final zone in _zones)
        if (MatrixUtils.inverseTransformRect(toRoot, zone).intersect(bounds)
            case final hole when hole.width > 0 && hole.height > 0)
          hole,
    ];
  }

  /// What the clip hides takes no taps either: a button scrolled under the
  /// status items must not fire from the part nobody can see.
  @override
  bool hitTest(BoxHitTestResult result, {required Offset position}) {
    if (holes.any((hole) => hole.contains(position))) return false;
    return super.hitTest(result, position: position);
  }

  @override
  void paint(PaintingContext context, Offset offset) {
    final holes = this.holes;
    if (holes.isEmpty || child == null) {
      _clip.layer = null;
      super.paint(context, offset);
      return;
    }
    final bounds = Offset.zero & size;
    final path =
        Path()
          ..fillType = PathFillType.evenOdd
          ..addRect(bounds);
    for (final hole in holes) {
      path.addRect(hole);
    }
    _clip.layer = context.pushClipPath(
      needsCompositing,
      offset,
      bounds,
      path,
      super.paint,
      oldLayer: _clip.layer,
    );
  }

  @override
  void dispose() {
    _clip.layer = null;
    super.dispose();
  }
}
