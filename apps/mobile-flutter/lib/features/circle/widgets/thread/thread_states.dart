import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/data/surface_cast.dart';
import '../../../../shared/widgets/feedback/kallo_surface_state.dart';
import '../../../../shared/widgets/feedback/sliver_centered_state.dart';
import '../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../shell/nav/nav_actions.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/thread_providers.dart';
import '../states/circle_error.dart';
import '../states/circle_skeleton.dart';

/// The thread page's three not-ready surfaces — loading, failed, gone — in
/// one padded scroll view. The screen keeps orchestration (focus, scroll,
/// dock height) and hands presentation here, so the page-inset arithmetic is
/// written once instead of once per state.
class ThreadStates extends StatelessWidget {
  const ThreadStates({required this.view, required this.onRetry, super.key});

  /// Never [ThreadReady] — that state is the body, not a placeholder.
  final ThreadView view;
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
          ThreadReady() => const SliverToBoxAdapter(child: SizedBox.shrink()),
        },
      ],
    );
  }
}
