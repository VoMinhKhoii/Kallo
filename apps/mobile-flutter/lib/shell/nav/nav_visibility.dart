import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Whether the pill nav is currently showing (true) or slid away by a downward
/// scroll (false).
///
/// Owns the hide-on-scroll rule itself: [TabScaffold]'s
/// `UserScrollNotification` listener hands every notification to [applyScroll]
/// and does nothing else, and the places that must always bring the bar back
/// (a tab switch, the Add sheet) call [reveal]. `PillNavVeil` reads the state.
///
/// THE RESIZE HAZARD: the bar is the Scaffold's `bottomNavigationBar` under
/// `extendBody`, so its LAID-OUT height is what Flutter reports to every tab
/// body as `MediaQuery.padding.bottom` (see `kallo_screen.dart` and
/// `kallo_refresh.dart`, and the `nav_clearance_test` that pins it). Hiding
/// the bar must therefore TRANSLATE it — never shrink, replace or remove it.
/// Collapsing it to a zero-size box would republish a bottom inset of 0 to
/// every scroll view mid-scroll and jump the content under the user's finger.
class NavVisibility extends Notifier<bool> {
  /// A page with barely more content than the viewport must never hide the
  /// nav: the few points of travel it has would trade the whole bar for a
  /// glimpse of one more row, and there would be nothing left to scroll back
  /// up through to get it returned.
  static const double _minScrollToHide = 120;

  @override
  bool build() => true;

  /// Bring the bar back — a tab switch or the Add sheet opening.
  void reveal() {
    if (!state) state = true;
  }

  /// Apply one scroll notification to the bar. Always returns false: this is a
  /// `NotificationListener` callback and the notification must keep bubbling.
  bool applyScroll(UserScrollNotification n) {
    // Depth 0 only — an inner horizontal strip or a sheet's own list is not
    // the branch scrolling.
    if (n.depth != 0 || n.metrics.axis != Axis.vertical) return false;

    final bool? hide = switch (n.direction) {
      _ when n.metrics.maxScrollExtent < _minScrollToHide => false,
      ScrollDirection.reverse => true,
      ScrollDirection.forward => false,
      // `idle` ends a gesture without expressing an intent — leave the bar
      // wherever the drag left it.
      ScrollDirection.idle => null,
    };
    if (hide != null && state == hide) state = !hide;
    return false;
  }
}

final navVisibilityProvider = NotifierProvider<NavVisibility, bool>(
  NavVisibility.new,
);
