import 'package:flutter/widgets.dart';

import '../../../shell/window/window_layout.dart';
import 'detail_pane.dart';
import 'page_window.dart';

/// Cards meet the gutter; only the window edge keeps its 12pt margin.
EdgeInsets paneInsets(
  BuildContext context, {
  double top = 0,
  double bottom = 0,
}) {
  final layout = DetailPane.layoutOf(context) ?? PageWindow.of(context);
  final detail = DetailPane.of(context);
  final nearLeft =
      detail
          ? DetailPane.nearLeftOf(context)
          : layout.controlEdge == ControlEdge.left;
  final flushLeft = layout.twoPane && (detail != nearLeft);
  return EdgeInsets.fromLTRB(
    flushLeft ? 0 : 12,
    top,
    layout.twoPane && !flushLeft ? 0 : 12,
    bottom,
  );
}
