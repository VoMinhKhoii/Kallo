import 'package:flutter/material.dart';

import '../../../../models/cheat.dart';
import '../../../../models/meal.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/logging_models.dart';
import '../../logic/feed/feed_entries.dart';
import '../../logic/feed/view_state.dart';
import '../../logic/logging_spacing.dart';
import '../terminal/logging_day_error_state.dart';
import 'feed_meal_card.dart';
import 'feed_no_meals_view.dart';
import 'staged_meal_card.dart';
import '../../../../shared/widgets/kallo_refresh.dart';

/// The scrollable day: every meal card — saved and staged alike, in the order
/// they were logged — with the live [footer] as the last item, plus the day's
/// error / empty / first-load branches.
class FeedList extends StatelessWidget {
  const FeedList({
    super.key,
    required this.view,
    required this.dockHeight,
    required this.scrollController,
    required this.footer,
    required this.confirmPending,
    required this.onRefresh,
    required this.onRetryDay,
    required this.onRemoveMeal,
    required this.onUpdateMeal,
    required this.onLogAgain,
    required this.onConfirm,
    required this.onConfirmCheat,
  });

  final FeedViewState view;

  /// A confirm is in flight — every staged card's controls go inert.
  final bool confirmPending;
  final void Function(String analysisId, List<MealQuantityEdit> edits) onConfirm;
  final void Function(String analysisId, CheatSliderLevels levels)
  onConfirmCheat;

  /// The floating composer dock's measured height — the scroll padding the feed
  /// reserves so its last card can always clear the dock it scrolls under.
  final double dockHeight;
  final ScrollController scrollController;

  /// The streaming / revealed / failed tail, rendered after the last card.
  final Widget footer;
  final Future<void> Function() onRefresh;
  final VoidCallback onRetryDay;
  final void Function(PersistedMeal meal) onRemoveMeal;
  final Future<void> Function(
    PersistedMeal meal, {
    required List<Map<String, dynamic>> edits,
    required List<String> removeIds,
  })
  onUpdateMeal;
  final Future<void> Function(PersistedMeal meal) onLogAgain;

  @override
  Widget build(BuildContext context) {
    // Drag-to-dismiss for every feed scroll view. `onDrag` alone is not enough:
    // it needs a ScrollUpdateNotification carrying dragDetails, which never
    // arrives when the drag is pure overscroll (dragging DOWN from the top
    // clamps, so pixels never move and only an OverscrollNotification fires). A
    // drag START always fires, whether or not the offset survives.
    return NotificationListener<ScrollStartNotification>(
      onNotification: (n) {
        if (n.depth == 0 && n.dragDetails != null) {
          FocusManager.instance.primaryFocus?.unfocus();
        }
        return false;
      },
      child: _buildBody(context),
    );
  }

  Widget _buildBody(BuildContext context) {
    final entries = view.entries;
    final hasCards = entries.isNotEmpty || view.hasLiveTail;

    // Day fetch error → red alert card with retry (LoggingDayErrorState).
    if (view.hasError && !hasCards) {
      return Padding(
        // Centre the alert in the space the dock leaves, not behind it.
        padding: EdgeInsets.only(bottom: dockHeight),
        child: LoggingDayErrorState(onRetry: onRetryDay),
      );
    }

    // ONE scroll view for every day that has anything in it, even when that is
    // only a staged card or the live turn. Branching on the saved-meal count
    // put a different scrollable on screen either side of the first save, so
    // confirming a meal tore the whole feed down and replayed every card's
    // entrance.
    if (!hasCards) {
      return FeedNoMealsView(view: view, dockHeight: dockHeight);
    }

    return KalloRefresh(
      onRefresh: onRefresh,
      child: ListView.separated(
        controller: scrollController,
        physics: const AlwaysScrollableScrollPhysics(),
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: EdgeInsets.fromLTRB(
          KalloSpacing.sp3,
          0,
          KalloSpacing.sp3,
          dockHeight,
        ),
        itemCount: entries.length + (view.hasLiveTail ? 1 : 0),
        // The ONE gap between turns — no card carries a bottom margin of its
        // own, so this separator is the whole story.
        separatorBuilder:
            (_, __) => const SizedBox(height: LoggingSpacing.turn),
        itemBuilder: (context, index) {
          if (index >= entries.length) return footer;
          // Keyed by the entry's own id, so confirming one meal leaves every
          // other card's element — and its scroll slot — exactly where it was.
          return switch (entries[index]) {
            SavedEntry(:final meal) => FeedMealCard(
              key: ValueKey(meal.id),
              meal: meal,
              onRemove: () => onRemoveMeal(meal),
              onUpdate:
                  ({required edits, required removeIds}) =>
                      onUpdateMeal(meal, edits: edits, removeIds: removeIds),
              onLogAgain: () => onLogAgain(meal),
            ),
            StagedEntry(:final pending) => StagedMealCard(
              key: ValueKey(pending.id),
              pending: pending,
              busy: confirmPending,
              onConfirm: onConfirm,
              onConfirmCheat: onConfirmCheat,
            ),
          };
        },
      ),
    );
  }
}
