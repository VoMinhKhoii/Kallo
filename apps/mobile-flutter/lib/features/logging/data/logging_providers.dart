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
      other is LoggingDayArgs &&
      other.userId == userId &&
      other.date == date;

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
        pendingConfirmations: current.pendingConfirmations
            .where((p) => p.id != analysisId)
            .toList(),
      ),
    );
  }

  /// Optimistically remove a persisted meal (on delete).
  void removeMeal(String mealId) {
    final current = state.valueOrNull;
    if (current == null) return;
    state = AsyncData(
      current.copyWith(
        persistedMeals:
            current.persistedMeals.where((m) => m.id != mealId).toList(),
      ),
    );
  }

  /// Roll back to a snapshot (on mutation error).
  void restore(LoggingDayData snapshot) {
    state = AsyncData(snapshot);
  }

  /// Refetch from the server (the `onSettled` invalidation analogue).
  Future<void> refresh() => ref.refresh(
        loggingDayProvider(LoggingDayArgs(arg.userId, arg.date)).future,
      );
}

final loggingDayProvider = AsyncNotifierProvider.family<LoggingDayNotifier,
    LoggingDayData, LoggingDayArgs>(LoggingDayNotifier.new);

/// Loads the set of dates that have logged meals (timeline "has meals" dots).
/// Keyed per-user; the timezone offset is folded in at fetch time.
final mealDatesProvider =
    FutureProvider.autoDispose.family<List<String>, String?>((ref, userId) async {
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
  return api.get<List<dynamic>>('/api/v1/meals/dates?tz=$tz').then(
        (list) => list.cast<String>(),
      );
});

/// The onboarding profile row the logging screen needs (calorie + macro
/// targets). Mirrors RN `useQuery({ queryKey: onboardingKeys.profile, ... })`.
final loggingProfileProvider =
    FutureProvider.autoDispose<Map<String, dynamic>?>((ref) async {
  final api = ref.watch(apiClientProvider);
  return api.get<Map<String, dynamic>?>('/api/v1/onboarding/profile');
});

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
      });
    } catch (error) {
      if (snapshot != null) notifier.restore(snapshot);
      rethrow;
    } finally {
      state = false;
      // onSettled: refetch the day + meal-dates list.
      await notifier.refresh();
      ref.invalidate(mealDatesProvider(arg));
    }
  }
}

/// Per-user confirm notifier. `isPending` == the bool state.
final confirmMealProvider =
    NotifierProvider.family<ConfirmMealNotifier, bool, String>(
  ConfirmMealNotifier.new,
);
