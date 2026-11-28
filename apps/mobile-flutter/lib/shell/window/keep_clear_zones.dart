import 'package:flutter/widgets.dart';

import 'window_layout.dart';

/// How far down the control column the outer display's camera, clock and
/// status icons reach when it is held upright.
///
/// No API reports where the system's own items sit, so these three are
/// measured from Duo simulator captures. Here they end near 156pt.
const double kOuterStatusClear = 168;

/// How far down the control column the inner display's clock and status
/// icons reach: near 113pt on the captures. It has no camera in the column.
const double kInnerStatusClear = 124;

/// The corner of the control column the camera takes on an outer display
/// turned on its side: its top with the column on the left, its bottom with
/// the column on the right. The camera ends near 60pt from that end, and the
/// clock and the status icons are not drawn in this window.
const double kCameraCornerClear = 76;

/// Where a window's control column holds the system's own items.
extension KeepClearZones on WindowLayout {
  /// The outer display on its side: short, and too narrow to split.
  bool get _turnedOuter => compactHeight && !twoPane;

  /// The parts of the control column that hold the system's own items, in
  /// window coordinates. Empty without a column.
  ///
  /// An upright outer display and the inner display keep the column's top
  /// for the status items ([kOuterStatusClear], [kInnerStatusClear]). An
  /// outer display on its side keeps only the camera's corner
  /// ([kCameraCornerClear]).
  List<Rect> get keepClear {
    if (!hasControlColumn) return const [];
    final left = nearLeft ? 0.0 : size.width - columnWidth;
    if (_turnedOuter) {
      final top = nearLeft ? 0.0 : size.height - kCameraCornerClear;
      return [Rect.fromLTWH(left, top, columnWidth, kCameraCornerClear)];
    }
    final reach =
        size.width >= kTwoPaneWidth ? kInnerStatusClear : kOuterStatusClear;
    return [Rect.fromLTWH(left, 0, columnWidth, reach)];
  }
}

/// The keep-clear corners a piece at [context] has to stay out of: the
/// window's, on a page that leaves the control column empty, and none
/// anywhere else.
List<Rect> keepClearZones(BuildContext context) {
  final layout = WindowLayout.of(context);
  return layout.columnFree ? layout.keepClear : const [];
}
