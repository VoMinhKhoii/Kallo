import 'package:flutter/material.dart';

import '../../../../theme/kallo_theme.dart';
import '../../logic/feed/view_state.dart';
import '../empty_state.dart';
import 'loading_skeletons.dart';

/// What the feed shows on a day with nothing in it at all: the empty state or
/// the first-load skeleton. The moment there is a card — saved, staged, or the
/// live turn — [FeedList]'s own scroll view takes over.
///
/// Empty → centered with vertical padding; loading → symmetric 12 padding,
/// full-width ghost cards (the old left timeline gutter is gone, matching web).
class FeedNoMealsView extends StatelessWidget {
  const FeedNoMealsView({
    super.key,
    required this.view,
    required this.dockHeight,
  });

  final FeedViewState view;

  /// The floating composer dock's measured height, reserved as bottom padding
  /// so the last card can always clear it.
  final double dockHeight;

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

    // The loading skeleton uses the same symmetric padding as the real cards;
    // the empty state is centered.
    if (view.isLoading) {
      return SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: EdgeInsets.fromLTRB(
          KalloSpacing.sp3,
          0,
          KalloSpacing.sp3,
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
                  KalloSpacing.sp6,
                  0,
                  KalloSpacing.sp6 + dockHeight,
                ),
                child: Center(child: body),
              ),
            ),
          ),
    );
  }
}
