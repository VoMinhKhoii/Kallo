/// Riverpod port of the logging surface's react-query hooks
/// (`use-logging-day`, `use-meal-dates`, `use-meal-mutations`) and the profile
/// fetch from `logging.tsx`.
///
/// Query keys / staleness / optimistic-update semantics mirror the RN hooks:
///   - the day query keys on (userId, date, tz) — `LoggingDayKeys.byUserDateOffset`,
///   - meal-dates keys on (userId, tz) — `mealDatesKey`,
///   - confirm/delete optimistically mutate the day cache then refetch
///     (the day) + the meal-dates list on settle.
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/api_client.dart';
import '../../../models/cheat.dart';
// Prefixed: dashboard_providers also exports a `loggingDayProvider`.
import '../../dashboard/data/dashboard_providers.dart' as dash;
import 'logging_keys.dart';
import 'logging_models.dart';

/// Identity for the day query family: (userId, date). The timezone offset is
/// derived at fetch time (it's constant within a session), matching the RN hook
/// which reads `new Date().getTimezoneOffset()` inline.
class LoggingDayArgs {
  const LoggingDayArgs(this.userId, this.date);
  final String userId;
  final String date;

  @override
  bool operator ==(Object other) =>
      other is LoggingDayArgs && other.userId == userId && other.date == date;

  @override
  int get hashCode => Object.hash(userId, date);
}

/// Loads a day's persisted meals + pending confirmations.
///
/// AsyncNotifier (not a bare FutureProvider) so the mutations can mutate the
/// cache optimistically — the RN `queryClient.setQueriesData` analogue — and
/// roll back on error, all keyed on the same (userId, date) family entry as the
/// 3-element invalidation prefix `LoggingDayKeys.byUserDate`.
class LoggingDayNotifier
    extends FamilyAsyncNotifier<LoggingDayData, LoggingDayArgs> {
  @override
  Future<LoggingDayData> build(LoggingDayArgs arg) async {
    final api = ref.watch(apiClientProvider);
    final tz = timezoneOffsetMinutes();
    final path =
        '/api/v1/logging/day?date=${Uri.encodeComponent(arg.date)}&tz=$tz';
    final json = await api.get<Map<String, dynamic>>(path);
    return LoggingDayData.fromJson(json);
  }

  /// Optimistically remove a pending confirmation (on confirm).
  void removePending(String analysisId) {
    final current = state.valueOrNull;
    if (current == null) return;
    state = AsyncData(
      current.copyWith(
        pendingConfirmations:
            current.pendingConfirmations
                .where((p) => p.id != analysisId)
                .toList(),
      ),
    );
  }

  /// Roll back to a snapshot (on mutation error).
  void restore(LoggingDayData snapshot) {
    state = AsyncData(snapshot);
  }

  /// Replace a persisted meal in place by id from an authoritative server
  /// response (the amount-edit reconcile). Same id, so the card updates without
  /// a remount — mirrors the web `upsertById` in `use-meal-mutations`. A no-op
  /// if the meal isn't in the current cache.
  void reconcileMeal(PersistedMeal meal) {
    final current = state.valueOrNull;
    if (current == null) return;
    if (!current.persistedMeals.any((m) => m.id == meal.id)) return;
    state = AsyncData(
      current.copyWith(
        persistedMeals: [
          for (final m in current.persistedMeals)
            if (m.id == meal.id) meal else m,
        ],
      ),
    );
  }

  /// Refetch from the server (the `onSettled` invalidation analogue).
  Future<void> refresh() => ref.refresh(
    loggingDayProvider(LoggingDayArgs(arg.userId, arg.date)).future,
  );
}

final loggingDayProvider = AsyncNotifierProvider.family<
  LoggingDayNotifier,
  LoggingDayData,
  LoggingDayArgs
>(LoggingDayNotifier.new);

/// Loads the set of dates that have logged meals (timeline "has meals" dots).
/// Keyed per-user; the timezone offset is folded in at fetch time.
final mealDatesProvider = FutureProvider.autoDispose.family<
  List<String>,
  String?
>((ref, userId) async {
  if (userId == null) return const [];
  // Keep this alive briefly so tab switches don't refetch (mirrors staleTime).
  final link = ref.keepAlive();
  Timer? timer;
  ref.onDispose(() => timer?.cancel());
  ref.onCancel(() {
    timer = Timer(const Duration(seconds: 60), link.close);
  });
  ref.onResume(() => timer?.cancel());

  final api = ref.watch(apiClientProvider);
  final tz = timezoneOffsetMinutes();
  return api
      .get<List<dynamic>>('/api/v1/meals/dates?tz=$tz')
      .then((list) => list.cast<String>());
});

/// Recent, de-duplicated cheat occasions — the "log it again" chips shown
/// above the composer while in cheat mode (`GET /api/v1/meals/cheat-occasions`).
/// Keyed per-user; invalidated by [invalidateMealSurfaces] so a fresh cheat
/// save refreshes the chips.
final recentCheatOccasionsProvider = FutureProvider.autoDispose
    .family<List<RecentCheatOccasion>, String?>((ref, userId) async {
      if (userId == null) return const [];
      final api = ref.watch(apiClientProvider);
      final list = await api.get<List<dynamic>>(
        '/api/v1/meals/cheat-occasions?limit=5',
      );
      return list
          .map((e) => RecentCheatOccasion.fromJson(e as Map<String, dynamic>))
          .toList();
    });

/// Stage a past cheat occasion for re-logging without re-running the estimator
/// (`POST /api/v1/meals/cheat-repeat`), then refresh the day so the staged
/// pending surfaces as a seeded slider card. Same server path as the web's
/// "log it again"; delivery is via the day refetch instead of local chat state.
Future<void> stageCheatRepeat(
  WidgetRef ref, {
  required String userId,
  required String sourceMealId,
  required String date,
}) async {
  final api = ref.read(apiClientProvider);
  await api.post<Map<String, dynamic>>('/api/v1/meals/cheat-repeat', {
    'sourceMealId': sourceMealId,
    'loggedDate': date,
    'timezoneOffset': timezoneOffsetMinutes(),
  });
  await ref
      .read(loggingDayProvider(LoggingDayArgs(userId, date)).notifier)
      .refresh();
}

/// A meal composed somewhere OTHER than the feed — the dashboard's quick-log
/// sheet, the first-run suggestion chips — parked here on the way to `/logging`.
///
/// A session provider rather than a `?meal=` query parameter for two reasons:
/// `/logging` is a shell branch that is often ALREADY mounted (a query param
/// would have to be re-read on every rebuild of the same location, with nothing
/// to mark it consumed), and the feed frequently is NOT mounted yet when the
/// text is produced — the profile fetch gates it behind a skeleton. Parking the
/// text lets the feed claim it on its first build, whenever that turns out to
/// be.
///
/// Exactly one consumer: [FeedArea], which nulls the slot the instant it claims
/// it, so a rebuild, a tab switch back or a hot reload cannot re-fire it.
final pendingMealProvider = StateProvider<String?>((ref) => null);

/// Session-scoped dismiss state for the once-daily "yesterday looks
/// under-logged" nudge, keyed by the yesterday date so a fresh day re-prompts.
/// Mirrors the web's in-memory `yesterdayPromptDismissed` useState — it resets
/// on app relaunch (not persisted), so the prompt is at most once per session.
final yesterdayPromptDismissedProvider = StateProvider.family<bool, String>(
  (ref, date) => false,
);

/// The onboarding profile row the logging screen needs (calorie + macro
/// targets). Mirrors RN `useQuery({ queryKey: onboardingKeys.profile, ... })`.
final loggingProfileProvider =
    FutureProvider.autoDispose<Map<String, dynamic>?>((ref) async {
      final api = ref.watch(apiClientProvider);
      return api.get<Map<String, dynamic>?>('/api/v1/onboarding/profile');
    });

/// Mark every meal-keyed surface stale after a meal mutation: the day feed
/// (optional — confirm awaits an explicit refresh instead), the timeline dots,
/// the recent-cheat chips, and the dashboard bundle/day. The dashboard reads the
/// day/macros/heatmap off its own bundle, keyed by (userId, date) — it must be
/// invalidated too or the Today card + week-strip ring keep showing the pre-log
/// cache.
///
/// Takes the `invalidate` method rather than a `ref` so a single canonical set
/// serves both provider callers (`ref.invalidate`, a [Ref]) and widget callers
/// (`ref.invalidate`, a `WidgetRef`) — the two ref types share the method but no
/// common supertype, so the tear-off is what unifies them.
void invalidateMealSurfaces(
  void Function(ProviderOrFamily) invalidate,
  String userId,
  String date, {
  bool includeDay = true,
}) {
  if (includeDay) {
    invalidate(loggingDayProvider(LoggingDayArgs(userId, date)));
  }
  invalidate(mealDatesProvider(userId));
  invalidate(recentCheatOccasionsProvider(userId));
  invalidate(dash.dashboardBundleProvider((userId: userId, date: date)));
  invalidate(dash.dashboardDayProvider((userId: userId, date: date)));
}

/// Confirm a pending analysis into a saved meal, with the RN hook's optimistic
/// removal + rollback + settle-invalidation behavior.
///
/// State `== true` while a confirm request is in flight (the RN
/// `confirmMeal.isPending` the feed disables steppers on). Exposed as a
/// per-user [Notifier] so the UI rebuilds when it flips.
class ConfirmMealNotifier extends FamilyNotifier<bool, String> {
  @override
  bool build(String userId) => false;

  Future<void> confirm({
    required String analysisId,
    required String mealId,
    required String originDate,
    List<Map<String, dynamic>>? edits,
    // Cheat-meal: the user's chosen slider positions (wire-keyed, 0–10). The
    // server recomputes nutrition from the staged spec + these levels.
    Map<String, double>? levels,
  }) async {
    final api = ref.read(apiClientProvider);
    final dayArgs = LoggingDayArgs(arg, originDate);
    final notifier = ref.read(loggingDayProvider(dayArgs).notifier);
    final snapshot = ref.read(loggingDayProvider(dayArgs)).valueOrNull;

    state = true;
    notifier.removePending(analysisId);
    try {
      await api.post<void>('/api/v1/meals/confirm', {
        'analysisId': analysisId,
        'mealId': mealId,
        if (edits != null && edits.isNotEmpty) 'edits': edits,
        if (levels != null) 'levels': levels,
      });
    } catch (error) {
      if (snapshot != null) notifier.restore(snapshot);
      rethrow;
    } finally {
      state = false;
      // onSettled: refetch the day (awaited — the feed swaps the pending card
      // for the saved one) + invalidate the other meal-keyed surfaces.
      try {
        await notifier.refresh();
      } catch (_) {
        ref.invalidate(loggingDayProvider(dayArgs));
      }
      invalidateMealSurfaces(
        ref.invalidate,
        arg,
        originDate,
        includeDay: false,
      );
    }
  }
}

/// Per-user confirm notifier. `isPending` == the bool state.
final confirmMealProvider =
    NotifierProvider.family<ConfirmMealNotifier, bool, String>(
      ConfirmMealNotifier.new,
    );
