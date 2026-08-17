/// Caching / staleness conventions mirroring the web TanStack Query client
/// (`components/providers/query-provider.tsx`).
///
/// Riverpod has no central `QueryClient`, so these are shared constants +
/// helpers each feature provider applies, plus a query-key registry so
/// invalidation prefixes match the web keys exactly.
library;

import 'api_client.dart';

/// react-query `staleTime: 60_000`. Data is considered fresh for this long;
/// feature providers should avoid refetching within the window.
const Duration kQueryStaleTime = Duration(milliseconds: 60_000);

/// Retry policy mirroring the RN client.
///
/// Non-retryable [ApiError]s (401 NOT_AUTHENTICATED, 400 VALIDATION_FAILED,
/// 404 PROFILE_NOT_FOUND) surface immediately. Network/transport errors (not
/// [ApiError]) retry up to twice. Returns whether another attempt should run.
///
/// `failureCount` is the number of attempts ALREADY failed (0 before the first
/// retry), matching react-query's `(failureCount, error)` semantics.
bool shouldRetryQuery(int failureCount, Object error) {
  if (error is ApiError) {
    return error.retryable && failureCount < 2;
  }
  return failureCount < 2;
}

/// Run [task], retrying per [shouldRetryQuery]. Use in feature
/// `FutureProvider`/`AsyncNotifier` bodies to replicate react-query's retry
/// loop. The last error is rethrown once retries are exhausted.
Future<T> runWithRetry<T>(Future<T> Function() task) async {
  var failureCount = 0;
  while (true) {
    try {
      return await task();
    } catch (error) {
      if (!shouldRetryQuery(failureCount, error)) rethrow;
      failureCount += 1;
    }
  }
}

/// Query-key registry — replicated from the RN feature `keys.ts` files so cache
/// shape and invalidation prefixes match. Riverpod families key off these
/// tuples; invalidation uses prefix matching (NEVER exact), same as TanStack.
///
/// Keep these aligned with:
///   - dashboard: `['dashboard-bundle', userId, date, timezoneOffset]`,
///     `dashboardKeys.heatmap(range)`, `weightSummaryKeys.byRange(range)`
///   - nutrition: `['nutrition','overview', range, tz ?? 'utc']`,
///     `['nutrition','candidates', nutrient]`
abstract final class QueryKeys {
  // ---- dashboard ----------------------------------------------------------
  static List<Object?> dashboardBundle(
    String userId,
    String date,
    int timezoneOffset,
  ) =>
      ['dashboard-bundle', userId, date, timezoneOffset];

  static const List<Object?> dashboardAll = ['dashboard'];
  static List<Object?> heatmap(Object range) => ['dashboard', 'heatmap', range];

  static const List<Object?> weightAll = ['weight-summary'];
  static List<Object?> weightByRange(Object range) =>
      ['weight-summary', range];

  // ---- nutrition ----------------------------------------------------------
  static const List<Object?> nutritionAll = ['nutrition'];
  static List<Object?> nutritionOverview(Object range, int? tz,
          [Object? scope]) =>
      ['nutrition', 'overview', range, tz ?? 'utc', scope ?? 'complete'];
  static List<Object?> nutritionCandidates(String nutrient) =>
      ['nutrition', 'candidates', nutrient];
}
