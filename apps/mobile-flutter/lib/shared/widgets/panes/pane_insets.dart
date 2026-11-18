import 'package:flutter/widgets.dart';

import '../../../shell/window/window_layout.dart';
import 'detail_pane.dart';
import 'pane_slot.dart';

/// Cards meet the gutter; only the window edge keeps its margin.
/// Routed details infer the near slot; unmarked lists infer the far slot.
EdgeInsets paneInsets(
  BuildContext context, {
  PaneSlot? slot,
  double side = 12,
  double top = 0,
  double bottom = 0,
}) {
  final layout = WindowLayout.of(context);
  final pane = slot ?? (DetailPane.of(context) ? PaneSlot.near : PaneSlot.far);
  final split = layout.twoPane && pane != PaneSlot.single;
  final flushLeft = split && ((pane == PaneSlot.near) != layout.nearLeft);
  return EdgeInsets.fromLTRB(
    flushLeft ? 0 : side,
    top,
    split && !flushLeft ? 0 : side,
    bottom,
  );
}
