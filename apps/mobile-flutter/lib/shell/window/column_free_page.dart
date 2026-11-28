import 'package:flutter/widgets.dart';

import 'keep_clear_root.dart';
import 'window_layout.dart';
import 'window_layout_scope.dart';

/// A route that puts none of our controls in the control column: the
/// signed-out flow, onboarding, the paywall and an invite.
///
/// On such a page the column is empty below the status items, so the page
/// takes the whole window and centres on the display rather than on what is
/// left beside the column. It removes the column's side from the insets its
/// subtree sees, so every `SafeArea` below centres on the window, and pins
/// the real window, marked [WindowLayout.columnFree], so the control column,
/// the two panes and the fold still resolve, and the column's side pane runs
/// to the window's edge. What stays empty is `WindowLayout.keepClear`: the
/// rows that sit beside it keep out through `KeepClear`, and scroll views
/// hide what scrolls into it through `KeepClearClip`.
///
/// The tabbed pages, Log and Settings keep the column: the tab capsule stands
/// in it. In a window without a column this changes nothing, and it is
/// mounted there too so a fold never rebuilds the page.
class ColumnFreePage extends StatelessWidget {
  const ColumnFreePage({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final layout = WindowLayout.of(context);
    final media = MediaQuery.of(context);
    EdgeInsets free(EdgeInsets insets) =>
        layout.nearLeft ? insets.copyWith(left: 0) : insets.copyWith(right: 0);
    return WindowLayoutScope(
      layout: layout.freeOfColumn,
      child: MediaQuery(
        data:
            layout.hasControlColumn
                ? media.copyWith(
                  padding: free(media.padding),
                  viewPadding: free(media.viewPadding),
                )
                : media,
        child: KeepClearRoot(child: child),
      ),
    );
  }
}
