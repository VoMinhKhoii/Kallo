/// The app's one pull-to-refresh — a SLIVER, and the physics that make it work.
///
/// [CupertinoSliverRefreshControl], not `RefreshIndicator.adaptive`. The two
/// look similar for a frame and then behave nothing alike: Material's is a
/// floating puck, so it lets the list spring back to rest the moment the finger
/// lifts and spins a detached disc over content that already looks settled.
/// The iOS control is part of the scroll view — it holds the list's inset open
/// for exactly as long as its `onRefresh` future runs and collapses it when the
/// load lands, which is why an iOS refresh feels like the list is doing the
/// work rather than a widget floating above it (device report, 2026-09-01:
/// "it springs back with the load still running").
///
/// Being a sliver is the whole mechanism — the held-open inset IS a sliver
/// extent — so every surface that wants it must be a [CustomScrollView] with
/// this as its FIRST sliver.
library;

import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';

/// The physics a scroll view needs for [KalloRefresh] to work at all.
///
/// The control is driven by NEGATIVE overscroll, which clamping physics never
/// produce — under Android's default the list simply stops at the top and the
/// pull does nothing. Bouncing is also the right feel for the rest of the app,
/// which is iOS-native throughout. `AlwaysScrollable` on top so a short page
/// (an empty day, a new Circle) can still be pulled.
const ScrollPhysics kRefreshPhysics = AlwaysScrollableScrollPhysics(
  parent: BouncingScrollPhysics(),
);

class KalloRefresh extends StatelessWidget {
  const KalloRefresh({super.key, required this.onRefresh});

  /// Awaited: the list stays held down for precisely this long. Hand it the
  /// real refetch (`ref.refresh(provider.future)`), never a fire-and-forget
  /// call — the inset is the app's only "still loading" signal here.
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) => CupertinoSliverRefreshControl(
    // `CupertinoSliverRefreshControl` fires no haptic of its own, so the
    // refresh committed with nothing to feel. iOS Mail and Messages both tick
    // at the instant the pull crosses the trigger — this callback IS that
    // instant, so the impact belongs here rather than around [onRefresh].
    onRefresh: () {
      HapticFeedback.lightImpact();
      return onRefresh();
    },
  );
}

/// A refreshable page scroll: the three things above, assembled.
///
/// The contract this file documents — bouncing physics, the control FIRST in
/// the sliver list — was previously re-typed at every call site, and one copy
/// (the dashboard skeleton) quietly shipped neither. This owns all of it, so a
/// page only says what its content is.
///
/// [slivers] is a builder because the bottom inset is the caller's to place:
/// the shell's floating pill nav reports its measured height through
/// `MediaQuery.padding.bottom` under `extendBody`, and a page pays it inside
/// the padding of whichever sliver it ends on (Nutrition's tail is a
/// `SliverFillRemaining`, which a trailing spacer sliver would push off the
/// viewport). Pushed routes report 0 there and pay their own dock instead.
class KalloRefreshableScroll extends StatelessWidget {
  const KalloRefreshableScroll({
    super.key,
    required this.onRefresh,
    required this.slivers,
    this.controller,
    // onDrag, not manual: dragging a list with the keyboard up dismisses it
    // on iOS, and only `feed_list` had opted in — so every other refreshable
    // page kept the keyboard over the content the drag was trying to reveal.
    // A page that wants the keyboard to survive a drag can still say so.
    this.keyboardDismissBehavior = ScrollViewKeyboardDismissBehavior.onDrag,
  });

  final Future<void> Function() onRefresh;

  /// The page's own slivers, given the bottom inset the nav (or the home
  /// indicator) is asking for.
  final List<Widget> Function(double bottomInset) slivers;

  final ScrollController? controller;
  final ScrollViewKeyboardDismissBehavior keyboardDismissBehavior;

  @override
  Widget build(BuildContext context) => CustomScrollView(
    controller: controller,
    physics: kRefreshPhysics,
    keyboardDismissBehavior: keyboardDismissBehavior,
    slivers: [
      KalloRefresh(onRefresh: onRefresh),
      ...slivers(MediaQuery.paddingOf(context).bottom),
    ],
  );
}
