/// The thread page's four empty-ish surfaces — loading, failed, gone, and a
/// readable post with nothing said under it yet.
///
/// The fourth lives here rather than in `thread_body.dart` because `states/` is
/// this repo's word for "the loading / error / empty states of a surface"
/// (AGENTS.md §3), and splitting it off by the accident of being the one that
/// needs a sliver left one surface's states in two files.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import 'package:flutter/foundation.dart';

import '../../../../shared/data/surface_cast.dart';
import '../../../../shared/widgets/feedback/kallo_surface_state.dart';
import '../../../../shared/widgets/feedback/sliver_centered_state.dart';
import '../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../shell/nav/nav_actions.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/thread_providers.dart';
import '../states/circle_error.dart';
import '../states/circle_skeleton.dart';
import 'thread_dock_insets.dart';

/// The first three — loading, failed, gone — in one padded scroll view. The
/// screen keeps orchestration (focus, scroll, dock height) and hands
/// presentation here, so the page-inset arithmetic is written once instead of
/// once per state.
class ThreadStates extends StatelessWidget {
  const ThreadStates({required this.view, required this.onRetry, super.key});

  /// Typed [ThreadNotReady]: the ready state is the body, not a placeholder,
  /// and the switch below is exhaustive over exactly what can arrive here.
  final ThreadNotReady view;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    // No dock in these states, so the page owes the home indicator itself.
    final safeBottom = MediaQuery.paddingOf(context).bottom;
    final insets = EdgeInsets.fromLTRB(
      KalloSpacing.sp3,
      KalloSpacing.sp3,
      KalloSpacing.sp3,
      KalloSpacing.sp3 + safeBottom,
    );
    return CustomScrollView(
      slivers: [
        switch (view) {
          // Top-anchored ON PURPOSE, unlike the two states below it: the
          // skeleton is a preview of where the post's card will land, so it
          // has to sit exactly where that card sits. Centring it would move
          // the whole page on load.
          ThreadLoading() => SliverPadding(
            padding: insets,
            sliver: const SliverToBoxAdapter(child: CircleWallSkeleton()),
          ),
          // Failed and gone are the whole page — nothing else is on it — so
          // they sit at its middle rather than under the top inset.
          ThreadFailed() => SliverCenteredState(
            padding: insets,
            child: CircleErrorCard(onRetry: onRetry),
          ),
          // Never auto-pop: a screen that closes itself under the user's thumb
          // reads as a crash. Say what happened and offer the way back.
          ThreadMissing() => SliverCenteredState(
            padding: insets,
            child: KalloSurfaceState(
              area: SurfaceArea.circle,
              kind: SurfaceKind.empty,
              title: tr('groups.feed.threadGone'),
              subtitle: tr('groups.feed.threadGoneBody'),
              action: KalloButton(
                title: tr('common.back'),
                variant: KalloButtonVariant.cta,
                // Same exit as the header's chevron: a cold entry has no shell
                // beneath this page, and `maybePop` there would do nothing.
                onPressed:
                    () => popOr(context, (router) => router.go('/circle')),
              ),
            ),
          ),
        },
      ],
    );
  }
}

/// A thread with no replies yet, centred in what is left of the page.
///
/// The capybara is back (it was dropped for one muted line in `40e1cbe`). A
/// thread with no replies is not a post with a note under it — it is a LIST
/// with nothing in it, and the app answers an empty list with its cast
/// everywhere else, so the one surface that answered with grey text read as the
/// page having failed to finish drawing. It is the `compact` state, which is
/// the size that belongs under a single post.
///
/// Centred rather than tucked under the card since 2026-09-22: pinned there it
/// left the bottom two thirds of the page blank, which reads as content still
/// loading. [SliverCenteredState] measures what the post card left over, so the
/// state sits in the middle of the void it is explaining.
class ThreadEmptySliver extends StatelessWidget {
  const ThreadEmptySliver({required this.dockHeight, super.key});

  final ValueListenable<double> dockHeight;

  @override
  Widget build(BuildContext context) => SliverCenteredState(
    padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp3),
    child: ThreadDockTail(
      dockHeight: dockHeight,
      // No `extra` here, unlike the replies: this state is CENTRED, and a
      // break under it is a break the centring then has to split — the
      // capybara would sit half of it above true middle. The gap it needs from
      // the card is the half of the void above it.
      child: KalloSurfaceState(
        area: SurfaceArea.circle,
        kind: SurfaceKind.empty,
        compact: true,
        title: tr('groups.feed.noReplies'),
        subtitle: tr('groups.feed.noRepliesBody'),
      ),
    ),
  );
}
