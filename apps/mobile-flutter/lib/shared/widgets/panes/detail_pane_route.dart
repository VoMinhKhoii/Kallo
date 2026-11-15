import 'package:flutter/material.dart';

import '../../../shell/window/window_layout.dart';
import 'detail_pane_frame.dart';

/// Transparent outside the detail so the existing list remains interactive.
/// Material transitions and back gestures still own compact-window pushes.
class DetailPaneRoute<T> extends PageRoute<T>
    with MaterialRouteTransitionMixin<T> {
  DetailPaneRoute({required this.builder, super.settings});
  final WidgetBuilder builder;

  @override
  bool get maintainState => true;

  @override
  Widget buildContent(BuildContext context) => builder(context);

  @override
  bool get opaque => false;

  // A visible list must stay on its rail while the detail arrives.
  @override
  bool canTransitionFrom(TransitionRoute<dynamic> previousRoute) => false;

  @override
  Widget buildModalBarrier() => const IgnorePointer();

  @override
  Widget buildPage(
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
  ) => DetailPaneFrame(
    child: super.buildPage(context, animation, secondaryAnimation),
  );

  @override
  Widget buildTransitions(
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    if (WindowLayout.of(context).twoPane) return child;
    return super.buildTransitions(
      context,
      animation,
      secondaryAnimation,
      child,
    );
  }
}

/// The router keeps the same page identity in every window class.
class DetailPanePage<T> extends Page<T> {
  const DetailPanePage({required this.child, super.key});
  final Widget child;

  @override
  Route<T> createRoute(BuildContext context) => _PagedDetailPaneRoute<T>(this);
}

/// The route a [DetailPanePage] creates.
///
/// It reads its child from the CURRENT page, as Material's own page route
/// does: the navigator updates a route in place when its page is replaced by
/// one of the same type and key, and a child captured at creation would go on
/// showing the first thread after the router had moved to another.
class _PagedDetailPaneRoute<T> extends DetailPaneRoute<T> {
  _PagedDetailPaneRoute(DetailPanePage<T> page)
    : super(settings: page, builder: (_) => page.child);

  @override
  Widget buildContent(BuildContext context) =>
      (settings as DetailPanePage<T>).child;
}
