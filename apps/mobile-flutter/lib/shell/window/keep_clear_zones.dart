import 'package:flutter/widgets.dart';

import 'window_layout.dart';

/// How far down the control column a page keeps its own content out of it.
///
/// No API reports where the camera, the clock and the status icons sit, so
/// this is measured from Duo simulator captures: they end near 160pt on the
/// outer display and near 110pt on the inner one, and a turned outer display
/// with the column on the left has the camera in this corner.
const double kColumnTopClear = 168;

/// The bottom of the control column a page keeps clear in a short window,
/// also measured from simulator captures: a turned outer display with the
/// column on the right has the camera there.
const double kColumnBottomClear = 76;

/// Where a window's control column holds the system's own items.
extension KeepClearZones on WindowLayout {
  /// The parts of the control column that hold the system's own items, in
  /// window coordinates: its top [kColumnTopClear], and in a short window its
  /// bottom [kColumnBottomClear]. Empty without a column.
  List<Rect> get keepClear {
    if (!hasControlColumn) return const [];
    final left = nearLeft ? 0.0 : size.width - columnWidth;
    return [
      Rect.fromLTWH(left, 0, columnWidth, kColumnTopClear),
      if (compactHeight)
        Rect.fromLTWH(
          left,
          size.height - kColumnBottomClear,
          columnWidth,
          kColumnBottomClear,
        ),
    ];
  }
}

/// The keep-clear corners a piece at [context] has to stay out of: the
/// window's, on a page that leaves the control column empty, and none
/// anywhere else.
List<Rect> keepClearZones(BuildContext context) {
  final layout = WindowLayout.of(context);
  return layout.columnFree ? layout.keepClear : const [];
}
