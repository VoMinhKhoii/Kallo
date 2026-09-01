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
  Widget build(BuildContext context) =>
      CupertinoSliverRefreshControl(onRefresh: onRefresh);
}
