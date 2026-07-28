import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../data/api_client.dart';
import '../../../../shared/widgets/top_toast.dart';
import '../../data/logging_models.dart';
import '../../data/logging_providers.dart';
import '../../data/persisted_meal_mutations.dart';

/// Everything the feed does to an already-SAVED meal: swipe removal with its
/// undo window, amount edits, "log again", and pull-to-refresh.
///
/// The removal callbacks are the whole undo mechanism: the day cache is never
/// locally mutated, so the caller holds the meal id in a pending-removal set
/// (filtered out of the rendered feed) and undo, refetch races and failed
/// deletes all resolve by just adding/removing that id.
class FeedMealActions {
  const FeedMealActions({
    required this.context,
    required this.ref,
    required this.userId,
    required this.date,
    required this.onHoldRemoval,
    required this.onReleaseRemoval,
    required this.onRemovalFailed,
  });

  final BuildContext context;
  final WidgetRef ref;
  final String userId;
  final String date;

  /// Take the meal out of the rendered feed for the undo window.
  final ValueChanged<String> onHoldRemoval;

  /// Put it back / let it go: the id stops being filtered out.
  final ValueChanged<String> onReleaseRemoval;

  /// The DELETE was rejected — release the id AND surface the error.
  final ValueChanged<String> onRemovalFailed;

  /// Trailing-swipe removal of a saved meal: the day visibly heals (the meal
  /// drops out of the totals immediately) with a 5-second undo. The DELETE only
  /// fires if the undo window closes. No confirm modal; nothing is destroyed
  /// within the grace window.
  void remove(PersistedMeal meal) {
    onHoldRemoval(meal.id);
    _finalizeRemoval(meal);
  }

  /// Persist an amount edit (gram overrides + per-row removals) on a saved meal.
  Future<void> update(
    PersistedMeal meal, {
    required List<Map<String, dynamic>> edits,
    required List<String> removeIds,
  }) => updatePersistedMeal(
    context,
    ref,
    userId: userId,
    date: date,
    mealId: meal.id,
    edits: edits,
    removeIds: removeIds,
  );

  /// Re-log a saved meal onto the current day.
  Future<void> logAgain(PersistedMeal meal) =>
      logMealAgain(context, ref, userId: userId, date: date, mealId: meal.id);

  /// Pull-to-refresh: refetch the day + the meal-dates strip. Awaited so the
  /// platform refresh control holds its spinner until the data settles.
  Future<void> refreshDay() async {
    ref.invalidate(mealDatesProvider(userId));
    await ref
        .read(loggingDayProvider(LoggingDayArgs(userId, date)).notifier)
        .refresh();
  }

  Future<void> _finalizeRemoval(PersistedMeal meal) async {
    var undone = false;
    // Top-anchored undo toast (every toast lives at the top now). Its future
    // resolves on dismissal — by Undo, tap, or timeout — mirroring the old
    // SnackBar.closed, so the delete still finalizes only after the window.
    await showTopToast(
      context,
      'logging.mealRemoved'.tr(),
      actionLabel: 'logging.undo'.tr(),
      duration: const Duration(seconds: 5),
      onAction: () {
        undone = true;
        if (context.mounted) onReleaseRemoval(meal.id);
      },
    );
    if (undone || !context.mounted) return;
    try {
      await ref
          .read(apiClientProvider)
          .delete<void>('/api/v1/meals/${Uri.encodeComponent(meal.id)}');
    } catch (_) {
      // The server rejected the delete — releasing the id makes the card
      // reappear (the cache was never mutated), keeping the feed truthful.
      // Heal the day here (nothing refetches it after) plus the rest of the
      // canonical meal surfaces.
      invalidateMealSurfaces(ref.invalidate, userId, date);
      if (context.mounted) onRemovalFailed(meal.id);
      return;
    }
    if (!context.mounted) return;
    // The delete landed — heal every date-keyed surface before releasing the
    // id, then refetch the day itself (includeDay:false — the refresh below
    // owns it) so the refetched day (sans meal) is what renders.
    invalidateMealSurfaces(ref.invalidate, userId, date, includeDay: false);
    try {
      await ref
          .read(loggingDayProvider(LoggingDayArgs(userId, date)).notifier)
          .refresh();
    } catch (_) {
      // The refetch failing doesn't un-delete the meal — keep the id
      // filtered (a harmless no-op once a later fetch succeeds).
      return;
    }
    if (context.mounted) onReleaseRemoval(meal.id);
  }
}
