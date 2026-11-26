import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/onboarding/widgets/backdrop/backdrop_slice.dart';
import 'package:kallo_mobile/features/onboarding/widgets/backdrop/start_aurora.dart';
import 'package:kallo_mobile/features/onboarding/widgets/backdrop/step_backdrop.dart';
import 'package:kallo_mobile/shared/widgets/brand/kallo_wordmark.dart';
import 'package:kallo_mobile/shared/widgets/surface/aurora_glow.dart';
import 'package:kallo_mobile/shell/window/keep_clear_clip.dart';

/// Washes that fill the window behind a page on purpose. Nothing under them
/// is foreground.
const _backgrounds = {StepBackdrop, StartAurora, AuroraGlow, BackdropSlice};

/// Foreground pieces painted under [root] that a viewer can see inside one
/// of [zones]: text and icon glyphs, fields, images, the wordmark, and any
/// box that paints a fill, a border or a shadow (buttons, cards, bars).
///
/// Each piece is measured where it is painted (through every transform) and
/// cut to every clip above it, so a row scrolled out of its viewport, a face
/// faded to nothing or a route offstage does not count. A box running the
/// whole window's width is a band behind the page, not a piece on it.
///
/// A scroll view's [KeepClearClip] hides what scrolls into a corner, so a
/// piece under one counts only where the page put it at rest: in the top
/// corner, unless [scrolled]. Content running on past the bottom of a scroll
/// view is cut by the clip at rest too, as at any viewport's edge, and so is
/// scroll content inside one of [covers], the bands pinned over it.
List<String> keepClearCollisions(
  WidgetTester tester,
  Finder root,
  List<Rect> zones, {
  bool scrolled = false,
  List<Rect> covers = const [],
}) {
  if (zones.isEmpty) return const [];
  final window =
      Offset.zero & (tester.view.physicalSize / tester.view.devicePixelRatio);
  final hits = <String>[];
  void visit(Element element) {
    if (_backgrounds.contains(element.widget.runtimeType)) return;
    final render = element.renderObject;
    if (element is RenderObjectElement && render is RenderBox) {
      for (final rect in _pieces(element.widget, render)) {
        final whole = MatrixUtils.transformRect(
          render.getTransformTo(null),
          rect,
        );
        final (seen, clip) = _visible(render, whole);
        if (seen == null || seen.isEmpty) continue;
        if (seen.left <= window.left + .5 && seen.right >= window.right - .5) {
          continue;
        }
        for (final zone in zones) {
          // Under the clip, a piece counts at rest unless it runs on past
          // the bottom of its scroll view, as overflowing content does.
          if (clip != null &&
              (scrolled || (zone.top > 0 && whole.bottom > clip.bottom + .5))) {
            continue;
          }
          final overlap = seen.intersect(zone);
          // Scroll content running under a band pinned over it (the
          // wizard's button band) is hidden there by the band.
          if (clip != null &&
              covers.any(
                (c) =>
                    c.contains(overlap.topLeft) &&
                    c.contains(overlap.bottomRight - const Offset(.01, .01)),
              )) {
            continue;
          }
          if (overlap.width > .5 && overlap.height > .5) {
            hits.add('${_label(element)} at $seen');
          }
        }
      }
    }
    element.visitChildren(visit);
  }

  for (final element in root.evaluate()) {
    visit(element);
  }
  return hits;
}

/// Local rects of what [render] paints as foreground, if anything.
Iterable<Rect> _pieces(Widget widget, RenderBox render) sync* {
  if (!render.hasSize) return;
  if (render is RenderParagraph) {
    final length = render.text.toPlainText().trim().length;
    if (length == 0) return;
    for (final box in render.getBoxesForSelection(
      TextSelection(
        baseOffset: 0,
        extentOffset: render.text.toPlainText().length,
      ),
    )) {
      yield box.toRect();
    }
  } else if (render is RenderEditable ||
      render is RenderImage ||
      widget is KalloWordmark) {
    yield Offset.zero & render.size;
  } else if (render is RenderDecoratedBox) {
    final decoration = render.decoration;
    if (decoration is BoxDecoration && _paints(decoration)) {
      yield Offset.zero & render.size;
    } else if (decoration is ShapeDecoration &&
        ((decoration.color?.a ?? 0) > 0 || decoration.shadows != null)) {
      yield Offset.zero & render.size;
    }
  } else if (render is RenderPhysicalShape || render is RenderPhysicalModel) {
    yield Offset.zero & render.size;
  }
}

bool _paints(BoxDecoration d) =>
    (d.color?.a ?? 0) > 0 ||
    d.gradient != null ||
    d.border != null ||
    (d.boxShadow?.isNotEmpty ?? false);

/// [rect] (global) cut to every clip above [render], or null when an
/// ancestor hides it; and the box of a [KeepClearClip] that cuts the corners
/// out of it, if one does.
(Rect?, Rect?) _visible(RenderObject render, Rect rect) {
  var seen = rect;
  Rect? clipped;
  RenderObject child = render;
  var parent = child.parent;
  while (parent != null) {
    if ((parent is RenderOffstage && parent.offstage) ||
        (parent is RenderOpacity && parent.opacity == 0) ||
        (parent is RenderAnimatedOpacity && parent.opacity.value == 0) ||
        (parent is RenderSliverOpacity && parent.opacity == 0) ||
        !parent.paintsChild(child)) {
      return (null, null);
    }
    if (parent is RenderKeepClearClip && parent.holes.isNotEmpty) {
      clipped = MatrixUtils.transformRect(
        parent.getTransformTo(null),
        Offset.zero & parent.size,
      );
    }
    final clip = parent.describeApproximatePaintClip(child);
    if (clip != null) {
      seen = seen.intersect(
        MatrixUtils.transformRect(parent.getTransformTo(null), clip),
      );
      if (seen.width <= 0 || seen.height <= 0) return (Rect.zero, clipped);
    }
    child = parent;
    parent = child.parent;
  }
  return (seen, clipped);
}

String _label(Element element) {
  final render = element.renderObject;
  if (render is RenderParagraph) {
    final text = render.text.toPlainText();
    return '"${text.length > 30 ? '${text.substring(0, 30)}…' : text}"';
  }
  return element.widget.runtimeType.toString();
}
