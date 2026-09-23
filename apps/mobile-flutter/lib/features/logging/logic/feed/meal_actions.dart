import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../models/http/api_error.dart';
import '../../../../services/http/api_client.dart';
import '../../../../shared/widgets/toast/top_toast.dart';
import '../../../circle/data/circle_providers.dart'
    show mealShareInvitesProvider;
import '../../data/logging_models.dart';
import '../../data/logging_providers.dart';
import '../../data/mutations/persisted_meal_mutations.dart';

/// Everything the feed does to a meal card that already exists server-side:
/// removal with its undo window (for a SAVED meal, and for a STAGED analysis
/// the user decided against), amount edits, "log again", and pull-to-refresh.
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

  /// Throw away a staged analysis the user does not want saved.
  ///
  /// Deliberately the same shape as [remove], down to the undo window: a staged
  /// card is a real server row (`pending_analyses`), so discarding it is a
  /// DELETE like any other, and the user should get the same five seconds to
  /// change their mind. Before this there was no way out of a staged card at
  /// all except confirming it or waiting out its 30-minute expiry.
  void discardPending(PendingMealConfirmation pending) {
    onHoldRemoval(pending.id);
    _finalizeDiscard(pending);
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

  Future<void> _finalizeDiscard(PendingMealConfirmation pending) =>
      _deleteAfterUndoWindow(
        id: pending.id,
        toast: 'logging.pendingDiscarded'.tr(),
        path: '/api/v1/meals/pending/${Uri.encodeComponent(pending.id)}',
        // A staged row expires on its own, and confirming it consumes it.
        // Either way the server says "not found" — and either way it IS gone,
        // so the card must stay gone. Only a real failure puts it back.
        goneMeansDeleted: true,
        // Discarding a card staged from a friend's cheat offer hands that offer
        // back (`releaseInvite`), so it belongs in the inbox again — and the
        // pill-nav badge keeps that provider alive, so without this both serve
        // a cached empty list until a pull-to-refresh. Only the server knows
        // whether THIS card owed an offer, so the refetch is unconditional.
        onDeleted: (scope) => scope.invalidate(mealShareInvitesProvider),
      );

  Future<void> _finalizeRemoval(PersistedMeal meal) => _deleteAfterUndoWindow(
    id: meal.id,
    toast: 'logging.mealRemoved'.tr(),
    path: '/api/v1/meals/${Uri.encodeComponent(meal.id)}',
  );

  /// Show the undo toast, then — unless Undo was tapped — DELETE [path].
  ///
  /// The day cache is never locally mutated: the card is hidden by its id in
  /// the pending-removal set, so undo, a failed delete and the refetch all
  /// resolve by releasing that id.
  ///
  /// Runs against the ProviderScope container captured up front, not `ref`:
  /// `/logging` is a route pushed over the shell, so leaving it inside the
  /// window disposes this feed (and `ref` throws once disposed). Gating the
  /// DELETE on `mounted` used to drop it silently. Only UI callbacks check it.
  Future<void> _deleteAfterUndoWindow({
    required String id,
    required String toast,
    required String path,
    bool goneMeansDeleted = false,
    void Function(ProviderContainer scope)? onDeleted,
  }) async {
    final scope = ProviderScope.containerOf(context, listen: false);
    var undone = false;
    // Top-anchored undo toast. Its future resolves on dismissal — by Undo,
    // tap, or timeout — so the delete finalizes only after the window.
    await showTopToast(
      context,
      toast,
      actionLabel: 'logging.undo'.tr(),
      duration: const Duration(seconds: 5),
      onAction: () {
        undone = true;
        if (context.mounted) onReleaseRemoval(id);
      },
    );
    if (undone) return;
    try {
      await scope.read(apiClientProvider).delete<void>(path);
    } catch (error) {
      final gone =
          goneMeansDeleted &&
          error is ApiError &&
          (error.status == 400 || error.status == 404);
      if (!gone) {
        // Releasing the id makes the card reappear, keeping the feed truthful.
        invalidateMealSurfaces(scope.invalidate, userId, date);
        if (context.mounted) onRemovalFailed(id);
        return;
      }
    }
    onDeleted?.call(scope);
    // Heal every date-keyed surface. With the feed still open the refresh
    // below owns the day, so the refetched day (sans card) is what renders;
    // with nobody on this day it is just marked stale.
    final open = context.mounted;
    invalidateMealSurfaces(scope.invalidate, userId, date, includeDay: !open);
    if (!open) return;
    try {
      await scope
          .read(loggingDayProvider(LoggingDayArgs(userId, date)).notifier)
          .refresh();
    } catch (_) {
      // A failed refetch doesn't un-delete it — keep the id filtered (a
      // harmless no-op once a later fetch succeeds).
      return;
    }
    if (context.mounted) onReleaseRemoval(id);
  }
}
