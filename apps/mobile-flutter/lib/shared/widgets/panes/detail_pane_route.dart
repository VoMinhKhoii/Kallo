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
  Route<T> createRoute(BuildContext context) =>
      DetailPaneRoute<T>(settings: this, builder: (_) => child);
}
