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
/// `keepPreviousData` semantics: a provider instance seeds from its own last
/// overview when it has one, and otherwise from whatever the account last saw —
/// so switching range or day scope keeps the page standing while the new
/// numbers land, rather than blanking to a grey skeleton and back.
final nutritionOverviewProvider = AsyncNotifierProvider.family<
  NutritionOverviewNotifier,
  NutritionOverview,
  NutritionOverviewArg
>(NutritionOverviewNotifier.new);

/// The last successful overview for each selection, so a returning instance
/// renders instantly instead of collapsing to a skeleton.
final Map<String, NutritionOverview> _lastOverviewByArg = {};

/// The last successful overview for the ACCOUNT, whatever selection produced
/// it — the fallback seed when a selection has nothing of its own yet.
///
/// This is `keepPreviousData`: switching range or day scope keeps the page
/// standing and swaps the numbers when they land, rather than blanking to grey
/// and back. It is safe now that the range selector reads the REQUESTED range
/// rather than the seeded overview's `resolvedRange` — otherwise the stale
/// value drove the highlight and 30d → 90d flashed 7d on the way.
final Map<String, NutritionOverview> _lastOverviewByAccount = {};

String _accountKey(String? userId) =>
    '${userId ?? 'signed-out'}:${nutritionTimezoneOffset()}';

String _overviewCacheKey(String? userId, NutritionOverviewArg arg) =>
    '${_accountKey(userId)}:${arg.range.value}:${arg.scope.value}';

class NutritionOverviewNotifier
    extends FamilyAsyncNotifier<NutritionOverview, NutritionOverviewArg> {
  @override
  Future<NutritionOverview> build(NutritionOverviewArg arg) async {
    final userId = ref.watch(currentSessionProvider)?.user.id;
    final cacheKey = _overviewCacheKey(userId, arg);
    // This selection's own data if we have it, otherwise whatever the account
    // last saw, so the layout never blanks mid-switch.
    final previous =
        _lastOverviewByArg[cacheKey] ?? _lastOverviewByAccount[_accountKey(userId)];
    if (previous != null) {
      state = AsyncData(previous);
    }
    final overview = await _fetch(arg);
    _remember(userId, arg, overview);
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

  void _remember(
    String? userId,
    NutritionOverviewArg arg,
    NutritionOverview overview,
  ) {
    _lastOverviewByArg[_overviewCacheKey(userId, arg)] = overview;
    _lastOverviewByAccount[_accountKey(userId)] = overview;
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
      _remember(ref.read(currentSessionProvider)?.user.id, arg, overview);
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
