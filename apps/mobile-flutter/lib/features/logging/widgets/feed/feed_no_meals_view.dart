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

    // Centred in the space the composer leaves, not in the raw viewport: the
    // dock is an overlay the feed runs under, so without reserving its height
    // the mark would sit visually low, half-hidden behind the input.
    //
    // The min-height box is what makes `Center` mean anything. A scroll view
    // sizes its child to the content, so a bare `Center` around a short block
    // centres it within its own height — i.e. does nothing, which is why the
    // empty state used to ride at the top.
    return LayoutBuilder(
      builder:
          (context, constraints) => SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: constraints.maxHeight),
              // Animated because the reserved height ARRIVES LATE and in steps: the
              // dock measures itself post-frame, so opening the `/` picker or
              // growing the field to a second line lands as one discrete jump that
              // would teleport the mark. The keyboard's own shift rides the
              // platform's animated inset — the viewport shrinks frame by frame, so
              // the block glides up with it rather than snapping.
              child: AnimatedPadding(
                duration: const Duration(milliseconds: 250),
                curve: Curves.easeOutCubic,
                padding: EdgeInsets.fromLTRB(
                  0,
                  NhamSpacing.sp6,
                  0,
                  NhamSpacing.sp6 + dockHeight,
                ),
                child: Center(child: body),
              ),
            ),
          ),
    );
  }
}
