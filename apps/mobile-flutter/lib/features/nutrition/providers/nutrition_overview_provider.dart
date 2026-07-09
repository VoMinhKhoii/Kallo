/// Riverpod port of the RN `useNutritionOverview` hook
/// (`apps/mobile/src/lib/nutrition/hooks/use-nutrition-overview.ts`).
///
/// Mirrors the web `NutritionShell` query exactly: 4-element key by range +
/// timezone bucket (`['nutrition','overview', range, tz ?? 'utc']`),
/// `retry:false`, 5-minute `staleTime`, and `placeholderData: keepPreviousData`
/// so the editorial layout stays in place while a new range refetches.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/api_client.dart';
import '../../../data/query.dart';
import '../../../data/session_provider.dart';
import '../../../models/nutrition.dart';

/// Raw `getTimezoneOffset()` parity: JS returns minutes POSITIVE west of UTC.
/// Dart's `timeZoneOffset` is positive EAST of UTC, so we negate it.
int nutritionTimezoneOffset() => -DateTime.now().timeZoneOffset.inMinutes;

/// The family argument: the requested range plus the day scope (all vs complete
/// days) the averages/series are computed over.
typedef NutritionOverviewArg = ({
  NutritionRangeInput range,
  NutritionDayScope scope,
});

/// Family keyed by (range, scope). The query key registry tuple is
/// `QueryKeys.nutritionOverview(range, tz, scope)`.
///
/// `keepPreviousData` semantics: when the family arg changes (range OR scope
/// toggle), the new provider instance keeps the previously-resolved overview as
/// its initial value so the layout doesn't collapse to a skeleton mid-refetch —
/// which is what makes the All/Complete swap feel instant.
final nutritionOverviewProvider = AsyncNotifierProvider.family<
  NutritionOverviewNotifier,
  NutritionOverview,
  NutritionOverviewArg
>(NutritionOverviewNotifier.new);

/// Holds the last successful overview across the family so a range switch can
/// seed the next instance (the RN `keepPreviousData` behavior). It is keyed by
/// user + timezone so an account switch can never seed another user's nutrition
/// pattern into the placeholder state.
final Map<String, NutritionOverview> _lastOverviewByAccount = {};

String _overviewCacheKey(String? userId) =>
    '${userId ?? 'signed-out'}:${nutritionTimezoneOffset()}';

class NutritionOverviewNotifier
    extends FamilyAsyncNotifier<NutritionOverview, NutritionOverviewArg> {
  @override
  Future<NutritionOverview> build(NutritionOverviewArg arg) async {
    final userId = ref.watch(currentSessionProvider)?.user.id;
    final cacheKey = _overviewCacheKey(userId);
    final previous = _lastOverviewByAccount[cacheKey];
    if (previous != null) {
      // Seed with the prior overview so consumers keep rendering the editorial
      // stack while the new range/scope loads (placeholderData: keepPreviousData).
      state = AsyncData(previous);
    }
    final overview = await _fetch(arg);
    _lastOverviewByAccount[cacheKey] = overview;
    return overview;
  }

  Future<NutritionOverview> _fetch(NutritionOverviewArg arg) async {
    final api = ref.read(apiClientProvider);
    final tz = nutritionTimezoneOffset();
    // retry:false in RN — surface failures immediately (no runWithRetry).
    final json = await api.get<Map<String, dynamic>>(
      '/api/v1/nutrition/overview?range=${arg.range.value}&tz=$tz'
      '&days=${arg.scope.value}',
    );
    return NutritionOverview.fromJson(json);
  }

  /// Refetch the current range — mirrors `query.refetch()`. Keeps the existing
  /// data visible while loading, and — critically — on FAILURE retains the
  /// previous overview underneath the error (`copyWithPrevious`) so a flaky
  /// refetch doesn't blank out the editorial stack the user is reading. The
  /// screen reads `hasValue` to keep rendering content and surfaces the failure
  /// as a toast instead.
  ///
  /// Returns true on success, false on failure (so the caller can toast).
  Future<bool> refetch() async {
    final previous = state;
    // Show the in-flight (isLoading) state over the current value.
    state = const AsyncValue<NutritionOverview>.loading().copyWithPrevious(
      previous,
    );
    try {
      final overview = await _fetch(arg);
      final userId = ref.read(currentSessionProvider)?.user.id;
      _lastOverviewByAccount[_overviewCacheKey(userId)] = overview;
      state = AsyncData(overview);
      return true;
    } catch (error, stack) {
      // Retain the previous data under the error.
      state = AsyncError<NutritionOverview>(
        error,
        stack,
      ).copyWithPrevious(previous);
      return false;
    }
  }
}

/// Convenience matching the RN `nutritionKeys.overview` tuple, exposed for
/// invalidation parity (prefix matching — never exact).
List<Object?> nutritionOverviewKey(NutritionOverviewArg arg) =>
    QueryKeys.nutritionOverview(
      arg.range.value,
      nutritionTimezoneOffset(),
      arg.scope.value,
    );
