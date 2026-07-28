import 'package:flutter/material.dart';

import '../../../../theme/nham_theme.dart';
import '../../logic/feed/view_state.dart';
import '../empty_state.dart';
import 'loading_skeletons.dart';

/// What the feed shows on a day with no saved meals yet: the empty state, the
/// first-load skeleton, or — when something is staged/streaming/failed — the
/// footer on its own.
///
/// Empty → centered with vertical padding; populated → symmetric 12 padding,
/// full-width cards (the old left timeline gutter is gone, matching web).
class FeedNoMealsView extends StatelessWidget {
  const FeedNoMealsView({
    super.key,
    required this.view,
    required this.dockHeight,
    required this.scrollController,
    required this.footer,
  });

  final FeedViewState view;

  /// The floating composer dock's measured height, reserved as bottom padding
  /// so the last card can always clear it.
  final double dockHeight;
  final ScrollController scrollController;
  final Widget footer;

  @override
  Widget build(BuildContext context) {
    final Widget body;
    if (view.isEmpty) {
      body = const EmptyState();
    } else if (view.isLoading) {
      // 2-item full-width card skeleton (LoggingDaySkeleton).
      body = const LoggingDaySkeleton();
    } else {
      body = const SizedBox.shrink();
    }

    // When there ARE footer items (pending/streaming) but no persisted meals,
    // the footer still renders with the gutter padding.
    if (view.hasFooterItems) {
      return SingleChildScrollView(
        controller: scrollController,
        // Without this the default physics refuse the drag outright whenever
        // the content is shorter than the viewport (setCanDrag(false)), so no
        // scroll notification ever fires and the keyboard cannot be dragged
        // away on a near-empty day.
        physics: const AlwaysScrollableScrollPhysics(),
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        // The macro block above owns the top gap; the bottom reserves the
        // floating dock's height so the last card can clear it.
        padding: EdgeInsets.fromLTRB(
          NhamSpacing.sp3,
          0,
          NhamSpacing.sp3,
          dockHeight,
        ),
        child: footer,
      );
    }

    // The loading skeleton uses the same symmetric padding as the real cards;
    // the empty state is centered.
    if (view.isLoading) {
      return SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: EdgeInsets.fromLTRB(
          NhamSpacing.sp3,
          0,
          NhamSpacing.sp3,
          dockHeight,
        ),
        child: body,
      );
    }

    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          0,
          NhamSpacing.sp6,
          0,
          NhamSpacing.sp6 + dockHeight,
        ),
        child: Center(child: body),
      ),
    );
  }
}
