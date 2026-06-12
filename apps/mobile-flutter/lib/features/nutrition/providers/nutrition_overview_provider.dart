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
import '../../../models/nutrition.dart';

/// Raw `getTimezoneOffset()` parity: JS returns minutes POSITIVE west of UTC.
/// Dart's `timeZoneOffset` is positive EAST of UTC, so we negate it.
int nutritionTimezoneOffset() => -DateTime.now().timeZoneOffset.inMinutes;

/// Family keyed by the requested range input (`auto` | `7d` | `30d` | `90d`).
/// The query key registry tuple is `QueryKeys.nutritionOverview(range, tz)`.
///
/// `keepPreviousData` semantics: when the family arg changes (range toggle),
/// the new provider instance keeps the previously-resolved overview as its
/// initial value so the layout doesn't collapse to a skeleton mid-refetch.
final nutritionOverviewProvider = AsyncNotifierProvider.family<
    NutritionOverviewNotifier, NutritionOverview, NutritionRangeInput>(
  NutritionOverviewNotifier.new,
);

/// Holds the last successful overview across the family so a range switch can
/// seed the next instance (the RN `keepPreviousData` behavior). Riverpod
/// rebuilds a fresh notifier per family key, so we stash the previous value
/// here at the Provider scope.
NutritionOverview? _lastOverview;

class NutritionOverviewNotifier
    extends FamilyAsyncNotifier<NutritionOverview, NutritionRangeInput> {
  @override
  Future<NutritionOverview> build(NutritionRangeInput arg) async {
    final previous = _lastOverview;
    if (previous != null) {
      // Seed with the prior overview so consumers keep rendering the editorial
      // stack while the new range loads (placeholderData: keepPreviousData).
      state = AsyncData(previous);
    }
    final overview = await _fetch(arg);
    _lastOverview = overview;
    return overview;
  }

  Future<NutritionOverview> _fetch(NutritionRangeInput range) async {
    final api = ref.read(apiClientProvider);
    final tz = nutritionTimezoneOffset();
    // retry:false in RN — surface failures immediately (no runWithRetry).
    final json = await api.get<Map<String, dynamic>>(
      '/api/v1/nutrition/overview?range=${range.value}&tz=$tz',
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
    final range = arg;
    final previous = state;
    // Show the in-flight (isLoading) state over the current value.
    state = const AsyncValue<NutritionOverview>.loading()
        .copyWithPrevious(previous);
    try {
      final overview = await _fetch(range);
      _lastOverview = overview;
      state = AsyncData(overview);
      return true;
    } catch (error, stack) {
      // Retain the previous data under the error.
      state = AsyncError<NutritionOverview>(error, stack)
          .copyWithPrevious(previous);
      return false;
    }
  }
}

/// Convenience matching the RN `nutritionKeys.overview` tuple, exposed for
/// invalidation parity (prefix matching — never exact).
List<Object?> nutritionOverviewKey(NutritionRangeInput range) =>
    QueryKeys.nutritionOverview(range.value, nutritionTimezoneOffset());
