import 'package:flutter/material.dart';

import '../../../../theme/nham_theme.dart';
import '../../data/logging_models.dart';
import '../../logic/feed/view_state.dart';
import '../../logic/logging_spacing.dart';
import '../terminal/logging_day_error_state.dart';
import 'feed_meal_card.dart';
import 'feed_no_meals_view.dart';
import '../../../../shared/widgets/nham_refresh.dart';

/// The scrollable day: the saved meal cards with the live [footer] as their
/// last item, plus the day's error / empty / first-load branches.
class FeedList extends StatelessWidget {
  const FeedList({
    super.key,
    required this.view,
    required this.dockHeight,
    required this.scrollController,
    required this.footer,
    required this.onRefresh,
    required this.onRetryDay,
    required this.onRemoveMeal,
    required this.onUpdateMeal,
    required this.onLogAgain,
  });

  final FeedViewState view;

  /// The floating composer dock's measured height — the scroll padding the feed
  /// reserves so its last card can always clear the dock it scrolls under.
  final double dockHeight;
  final ScrollController scrollController;

  /// The pending/streaming/revealed/failed tail, rendered after the last card.
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
    final persistedMeals = view.persistedMeals;

    // Day fetch error → red alert card with retry (LoggingDayErrorState).
    if (view.hasError && persistedMeals.isEmpty && !view.hasFooterItems) {
      return Padding(
        // Centre the alert in the space the dock leaves, not behind it.
        padding: EdgeInsets.only(bottom: dockHeight),
        child: LoggingDayErrorState(onRetry: onRetryDay),
      );
    }

    if (persistedMeals.isEmpty) {
      return FeedNoMealsView(
        view: view,
        dockHeight: dockHeight,
        scrollController: scrollController,
        footer: footer,
      );
    }

    return NhamRefresh(
      onRefresh: onRefresh,
      child: ListView.separated(
        controller: scrollController,
        physics: const AlwaysScrollableScrollPhysics(),
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: EdgeInsets.fromLTRB(
          NhamSpacing.sp3,
          0,
          NhamSpacing.sp3,
          dockHeight,
        ),
        itemCount: persistedMeals.length + (view.hasFooterItems ? 1 : 0),
        // The ONE gap between turns — no card carries a bottom margin of its
        // own, so this separator is the whole story.
        separatorBuilder:
            (_, __) => const SizedBox(height: LoggingSpacing.turn),
        itemBuilder: (context, index) {
          if (index < persistedMeals.length) {
            final meal = persistedMeals[index];
            return FeedMealCard(
              key: ValueKey(meal.id),
              meal: meal,
              isLast:
                  !view.hasFooterItems && index == persistedMeals.length - 1,
              onRemove: () => onRemoveMeal(meal),
              onUpdate:
                  ({required edits, required removeIds}) =>
                      onUpdateMeal(meal, edits: edits, removeIds: removeIds),
              onLogAgain: () => onLogAgain(meal),
            );
          }
          return footer;
        },
      ),
    );
  }
}
