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

  Future<void> _finalizeDiscard(PendingMealConfirmation pending) async {
    // Captured BEFORE the undo window: see [_outlivingScope].
    final scope = _outlivingScope();
    var undone = false;
    await showTopToast(
      context,
      'logging.pendingDiscarded'.tr(),
      actionLabel: 'logging.undo'.tr(),
      duration: const Duration(seconds: 5),
      onAction: () {
        undone = true;
        if (context.mounted) onReleaseRemoval(pending.id);
      },
    );
    // Only an explicit Undo keeps the card. Leaving the screen inside the
    // window is NOT an undo — see [_outlivingScope].
    if (undone) return;
    try {
      await scope
          .read(apiClientProvider)
          .delete<void>(
            '/api/v1/meals/pending/${Uri.encodeComponent(pending.id)}',
          );
    } on ApiError catch (error) {
      // A staged row expires on its own after 30 minutes, and confirming it
      // consumes it. Either way the server says "not found" — and either way it
      // IS gone, so the card must stay gone. Only a real failure puts it back.
      if (error.status != 400 && error.status != 404) {
        invalidateMealSurfaces(scope.invalidate, userId, date);
        if (context.mounted) onRemovalFailed(pending.id);
        return;
      }
    } catch (_) {
      invalidateMealSurfaces(scope.invalidate, userId, date);
      if (context.mounted) onRemovalFailed(pending.id);
      return;
    }
    invalidateMealSurfaces(scope.invalidate, userId, date, includeDay: false);
    // Discarding a card staged from a friend's cheat offer hands that offer
    // back (`releaseInvite`), so it belongs in the inbox again — and the
    // pill-nav badge watches that same auto-dispose provider, so without this
    // both keep serving a cached empty list until a pull-to-refresh. Nothing
    // here can tell whether THIS card owed an offer; only the server knows, so
    // the refetch is unconditional. A discard is a rare, deliberate action —
    // one extra request is cheaper than a reversible "not now" that silently
    // looks like it did nothing.
    //
    // Unconditional on `mounted` too: the usual way to leave is back to the
    // Circle, which is exactly where the offer reappears.
    scope.invalidate(mealShareInvitesProvider);
    if (!context.mounted) {
      // Nobody is looking at this day; mark it stale rather than refetching.
      scope.invalidate(loggingDayProvider(LoggingDayArgs(userId, date)));
      return;
    }
    try {
      await scope
          .read(loggingDayProvider(LoggingDayArgs(userId, date)).notifier)
          .refresh();
    } catch (_) {
      return;
    }
    if (context.mounted) onReleaseRemoval(pending.id);
  }

  Future<void> _finalizeRemoval(PersistedMeal meal) async {
    // Captured BEFORE the undo window: see [_outlivingScope].
    final scope = _outlivingScope();
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
    // Only an explicit Undo keeps the meal — see [_outlivingScope].
    if (undone) return;
    try {
      await scope
          .read(apiClientProvider)
          .delete<void>('/api/v1/meals/${Uri.encodeComponent(meal.id)}');
    } catch (_) {
      // The server rejected the delete — releasing the id makes the card
      // reappear (the cache was never mutated), keeping the feed truthful.
      // Heal the day here (nothing refetches it after) plus the rest of the
      // canonical meal surfaces.
      invalidateMealSurfaces(scope.invalidate, userId, date);
      if (context.mounted) onRemovalFailed(meal.id);
      return;
    }
    if (!context.mounted) {
      // The delete landed with nobody on this day: mark everything stale,
      // the day included, and let the next visit refetch it.
      invalidateMealSurfaces(scope.invalidate, userId, date);
      return;
    }
    // The delete landed — heal every date-keyed surface before releasing the
    // id, then refetch the day itself (includeDay:false — the refresh below
    // owns it) so the refetched day (sans meal) is what renders.
    invalidateMealSurfaces(scope.invalidate, userId, date, includeDay: false);
    try {
      await scope
          .read(loggingDayProvider(LoggingDayArgs(userId, date)).notifier)
          .refresh();
    } catch (_) {
      // The refetch failing doesn't un-delete the meal — keep the id
      // filtered (a harmless no-op once a later fetch succeeds).
      return;
    }
    if (context.mounted) onReleaseRemoval(meal.id);
  }

  /// The provider scope the undo window's DELETE runs against.
  ///
  /// `/logging` is a full-screen route pushed over the shell, so leaving it —
  /// the back gesture, or tapping through to Circle to tell a friend — disposes
  /// this feed while the 5-second undo toast (on the ROOT overlay) is still up.
  /// The DELETE used to be gated on `context.mounted` and was silently dropped
  /// in that case: the card only vanished locally, the server row survived,
  /// and a card staged from a friend's cheat offer kept that offer spent —
  /// nothing came back to the inbox, and the friend's re-share was skipped
  /// because the (still-live) card held it.
  ///
  /// The ProviderScope container outlives the screen, and `ref` does not
  /// (reading a disposed widget's ref throws), so it is captured while the
  /// context is still mounted and used for everything after the await. Only
  /// the UI callbacks stay behind `context.mounted`.
  ProviderContainer _outlivingScope() =>
      ProviderScope.containerOf(context, listen: false);
}
