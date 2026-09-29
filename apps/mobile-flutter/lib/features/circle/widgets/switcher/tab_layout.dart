import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';

/// Geometry of the Circle's tab row (approved canvas "E3", 2026-09-29).
///
/// The row spans the page edge to edge. The tabs share its width equally,
/// each at least as wide as its own content and never under [minWidth]; when
/// those minimums no longer fit, every tab sits at its minimum and the row
/// scrolls sideways.
abstract final class TabGeometry {
  /// No tab is narrower than this, so short names ("All", "Nhà") still get a
  /// generous target and the row never reads as a cramped list.
  static const double minWidth = 104;

  /// Inside a tab, around its content.
  static const double sidePad = KalloSpacing.sp3;
  static const double topPad = KalloSpacing.sp1;
  static const double bottomPad = KalloSpacing.sp2_5;

  /// Between the open tab's name and its faces.
  static const double facesGap = KalloSpacing.sp1_5;
  static const double faceSize = 26;
  static const double faceStep = 17;

  /// The unread dot after a closed tab's name.
  static const double dotSize = 6;
  static const double dotGap = 3;

  /// Faces that fit across a tab's content [width] (its share of the row,
  /// less [sidePad] each side): never fewer than two (a face and the "+N")
  /// nor more than five, so a wide tab still reads as a glance, not a list.
  static int faceSlots(double width) =>
      (((width - faceSize) / faceStep).floor() + 1).clamp(2, 5);

  static double clusterWidth(int slots) => faceSize + faceStep * (slots - 1);

  /// A name's size at the viewer's text scale.
  static Size measure(BuildContext context, String label) {
    final painter = TextPainter(
      text: TextSpan(text: label, style: dashBody()),
      textDirection: Directionality.of(context),
      textScaler: MediaQuery.textScalerOf(context),
      maxLines: 1,
    )..layout();
    final size = painter.size;
    painter.dispose();
    return size;
  }

  /// The width a tab's content needs: the name, plus the dot when there is
  /// one. The faces never ask for width — they take as many slots as the
  /// tab's share holds ([faceSlots]), so opening a tab never resizes it.
  static double natural(double labelWidth, {required bool unread}) =>
      labelWidth + (unread ? dotGap + dotSize : 0) + 2 * sidePad;

  /// The row's height: the open tab's name over its faces. Fixed, so the
  /// feed under the row never moves when a tab opens or its faces load.
  static double height(double labelHeight) =>
      topPad + labelHeight + facesGap + faceSize + bottomPad;
}

/// Each tab's width in a row [rowWidth] wide, given the width each one's
/// content needs ([naturals]).
///
/// Every tab gets at least `max(natural, minWidth)`. When those minimums fit,
/// the row is filled by sharing its width equally, and a tab whose minimum
/// is over the equal share keeps its minimum while the rest share what is
/// left — so the widths always add up to [rowWidth] exactly. When they do
/// not fit, the minimums are returned and the row scrolls.
List<double> tabWidths(List<double> naturals, double rowWidth) {
  final mins = [for (final n in naturals) math.max(n, TabGeometry.minWidth)];
  final total = mins.fold<double>(0, (sum, w) => sum + w);
  if (mins.isEmpty || total >= rowWidth) return mins;
  // Fix the tabs too wide for the share, one round at a time, until the
  // share holds for everyone left.
  final fixed = List<bool>.filled(mins.length, false);
  var free = rowWidth;
  var count = mins.length;
  while (true) {
    final share = free / count;
    var changed = false;
    for (var i = 0; i < mins.length; i++) {
      if (!fixed[i] && mins[i] > share) {
        fixed[i] = true;
        free -= mins[i];
        count--;
        changed = true;
      }
    }
    if (!changed) {
      return [for (var i = 0; i < mins.length; i++) fixed[i] ? mins[i] : share];
    }
  }
}

/// The scroll offset that brings tab [index] fully into view, clear of the
/// [fade] over the row's trailing edge; [current] when it already is.
double revealOffset(
  List<double> widths,
  int index, {
  required double current,
  required double viewport,
  required double maxExtent,
  double fade = 0,
}) {
  final left = widths.take(index).fold<double>(0, (sum, w) => sum + w);
  final right = left + widths[index];
  var target = current;
  if (left < current) {
    target = left;
  } else if (right > current + viewport - fade) {
    target = right - viewport + fade;
  }
  return target.clamp(0, math.max(0, maxExtent));
}
