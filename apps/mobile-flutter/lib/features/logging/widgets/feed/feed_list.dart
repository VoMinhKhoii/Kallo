import 'package:flutter/material.dart';

import '../../../../models/logging/cheat.dart';
import '../../../../models/logging/meal.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/logging_models.dart';
import '../../logic/feed/feed_entries.dart';
import '../../logic/feed/view_state.dart';
import '../../logic/logging_spacing.dart';
import '../terminal/logging_day_error_state.dart';
import 'feed_meal_card.dart';
import 'feed_scroll_pin.dart';
import 'feed_tail_room.dart';
import 'placeholder/feed_no_meals_view.dart';
import 'staged_meal_card.dart';
import '../../../../shared/widgets/feedback/kallo_refresh.dart';

/// The scrollable day: every meal card — saved and staged alike, in the order
/// they were logged — with the live [footer] as the last item, plus the day's
/// error / empty / first-load branches.
class FeedList extends StatelessWidget {
  const FeedList({
    super.key,
    required this.view,
    required this.dockHeight,
    required this.scrollController,
    required this.pin,
    required this.footer,
    required this.confirmPending,
    required this.onRefresh,
    required this.onRetryDay,
    required this.onRemoveMeal,
    required this.onDiscardPending,
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

  /// Lets the feed ask the tail to stay in view while an answer streams in.
  final FeedScrollPinHandle pin;

  /// The streaming / revealed / failed tail, rendered after the last card.
  final Widget footer;
  final Future<void> Function() onRefresh;
  final VoidCallback onRetryDay;
  final void Function(PersistedMeal meal) onRemoveMeal;
  final void Function(PendingMealConfirmation pending) onDiscardPending;
  final Future<void> Function(
    PersistedMeal meal, {
    required List<Map<String, dynamic>> edits,
    required List<String> removeIds,
  })
  onUpdateMeal;
  final Future<void> Function(PersistedMeal meal) onLogAgain;

  @override
  Widget build(BuildContext context) =>
      FeedScrollPin(
        handle: pin,
        controller: scrollController,
        child: _buildBody(context),
      );

  Widget _buildBody(BuildContext context) {
    final entries = view.entries;
    final hasCards = entries.isNotEmpty || view.hasLiveTail;

    // The room the last card needs to clear the dock. `/logging` is a root
    // route with no `Scaffold`, so this viewport is NOT resized by the
    // keyboard: the dock lifts itself by `viewInsets.bottom` and the feed owes
    // the same inset on top of the dock's own height. Read here rather than
    // received through [dockHeight] so both move on the SAME frame — and so
    // the ramp rebuilds this subtree only, never the whole feed.
    final reserve = dockHeight + MediaQuery.viewInsetsOf(context).bottom;

    // Day fetch error → red alert card with retry (LoggingDayErrorState).
    if (view.hasError && !hasCards) {
      return Padding(
        // Centre the alert in the space the dock leaves, not behind it.
        padding: EdgeInsets.only(bottom: reserve),
        child: LoggingDayErrorState(onRetry: onRetryDay),
      );
    }

    // ONE scroll view for every day that has anything in it, even when that is
    // only a staged card or the live turn. Branching on the saved-meal count
    // put a different scrollable on screen either side of the first save, so
    // confirming a meal tore the whole feed down and replayed every card's
    // entrance.
    if (!hasCards) {
      return FeedNoMealsView(view: view, dockHeight: reserve);
    }

    final itemCount = entries.length + (view.hasLiveTail ? 1 : 0);

    // The last item carries a viewport-tall floor once a send has asked for
    // the tail, so riding to the bottom puts the newest turn at the top.
    return FeedTailRoom(
      pin: pin,
      dockHeight: reserve,
      date: view.date,
      builder:
          (context, tailRoom) => KalloRefreshableScroll(
            controller: scrollController,
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            onRefresh: onRefresh,
            // Log is a pushed route, not a shell branch: no floating nav
            // reports itself here, and the composer dock the feed scrolls
            // under already measures its own safe-area inset.
            slivers: (_) => [
              SliverPadding(
                padding: EdgeInsets.fromLTRB(
                  KalloSpacing.sp3,
                  0,
                  KalloSpacing.sp3,
                  reserve,
                ),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    // `.separated`'s own arithmetic, since a sliver list has no
                    // separator slot: odd indices ARE the gap. The ONE gap
                    // between turns — no card carries a bottom margin of its
                    // own, so this separator is the whole story.
                    (context, index) {
                      if (index.isOdd) {
                        return const SizedBox(height: LoggingSpacing.turn);
                      }
                      final item = _itemAt(index ~/ 2, entries);
                      return index ~/ 2 == itemCount - 1
                          ? withTailRoom(tailRoom, item)
                          : item;
                    },
                    childCount: itemCount * 2 - 1,
                  ),
                ),
              ),
            ],
          ),
    );
  }

  Widget _itemAt(int index, List<FeedEntry> entries) {
    if (index >= entries.length) return footer;
    // Keyed by the entry's own id, so confirming one meal leaves every other
    // card's element — and its scroll slot — exactly where it was.
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
        onDiscard: () => onDiscardPending(pending),
      ),
    };
  }
}
