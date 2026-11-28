import 'package:flutter/widgets.dart';

import '../../../shell/window/keep_clear_clip.dart';
import '../../../shell/window/window_layout.dart';
import '../../../shell/window/window_layout_scope.dart';
import '../../../shell/window/window_regions.dart';
import 'paywall_gutter.dart';
import 'paywall_top_inset.dart';

/// The paywall in a window wide enough for two columns and too short to show
/// the table above the pinned buy band: the closed Duo or a phone on its
/// side, or Duo's open display under a pinned video. Stacked, the band
/// covered the whole table there. Side by side, the table is one column and
/// the decision (title, toggle, buttons) the other, each centred on the
/// window's height.
///
/// The decision takes the side of the system's control column, as the near
/// pane does beside a fold; where the window has a fold, the fold is the
/// seam. Neither side reaches under the control column, except on a page
/// that leaves it empty (`WindowLayout.columnFree`): there the decision's
/// side runs to the window's edge and its pieces keep out of the column's
/// keep-clear corners.
class PaywallSplit extends StatelessWidget {
  const PaywallSplit({
    required this.header,
    required this.table,
    required this.decision,
    super.key,
  });

  /// The close glyph and the wordmark, at the top of the decision's side:
  /// over the table they took the height its rows need.
  final Widget header;
  final Widget table;
  final Widget decision;

  /// The narrowest safe width that splits: the table at its unwrapped width
  /// and the decision at its narrowest.
  static const double minWidth = 560;

  /// Whether [layout] asks for this arrangement rather than one column.
  static bool fits(WindowLayout layout) =>
      layout.compactHeight && layout.contentWidth >= minWidth;

  /// The decision's share of a window with no fold, and its bounds. 284 is
  /// the narrowest that sets "Choose your plan" (233pt) on one line and
  /// gives "Monthly plan" (100pt when chosen) 10pt of air on both sides of
  /// its half of the toggle, inside the side's 16pt gutters. Past 340 the
  /// buttons stretch wider than anywhere else in the app.
  static const double _decisionShare = 0.4;
  static const double _decisionMin = 284;
  static const double _decisionMax = 340;

  @override
  Widget build(BuildContext context) {
    final layout = WindowLayout.of(context);
    final sides = _sides(layout);
    final tableGutter = PaywallGutter.forWidth(sides.table.width, alone: true);
    return Stack(
      children: [
        _side(context, layout, sides.table, tableGutter, table),
        _side(
          context,
          layout,
          sides.decision,
          // On a page that leaves the column empty the decision's outer
          // gutter matches the table's, so the pair centres on the display.
          layout.columnFree && !layout.twoPane
              ? tableGutter
              : PaywallGutter.decision,
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              header,
              Expanded(
                child: Center(
                  child: KeepClearClip(
                    child: SingleChildScrollView(child: decision),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  static ({Rect table, Rect decision}) _sides(WindowLayout layout) {
    final regions = WindowRegions(layout);
    if (layout.twoPane) return (table: regions.far, decision: regions.near);
    final safe = regions.safe;
    // The column's width stays in the decision's side when the page leaves
    // the column empty: its corner glyph and title keep out of the status
    // items, and the column still holds the width they had beside it.
    final column = layout.columnFree ? layout.columnWidth : 0.0;
    final width =
        ((safe.width - column) * _decisionShare).clamp(
          _decisionMin,
          _decisionMax,
        ) +
        column;
    return layout.nearLeft
        ? (
          decision: Rect.fromLTWH(safe.left, 0, width, safe.height),
          table: Rect.fromLTRB(safe.left + width, 0, safe.right, safe.bottom),
        )
        : (
          table: Rect.fromLTRB(safe.left, 0, safe.right - width, safe.bottom),
          decision: Rect.fromLTWH(safe.right - width, 0, width, safe.height),
        );
  }

  /// The side's own insets are taken out, as a pane's are, and the window's
  /// layout rides along so the pieces inside still see the whole window.
  static Widget _side(
    BuildContext context,
    WindowLayout layout,
    Rect rect,
    double gutter,
    Widget child,
  ) => Positioned(
    left: rect.left,
    width: rect.width,
    top: 0,
    bottom: 0,
    child: MediaQuery.removePadding(
      context: context,
      removeLeft: true,
      removeRight: true,
      child: MediaQuery.removeViewPadding(
        context: context,
        removeLeft: true,
        removeRight: true,
        child: WindowLayoutScope(
          layout: layout,
          child: PaywallGutter(
            value: gutter,
            child: PaywallTopInset(child: child),
          ),
        ),
      ),
    ),
  );
}
