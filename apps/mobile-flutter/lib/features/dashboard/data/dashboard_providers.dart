/// Riverpod providers for the dashboard surface.
///
/// These replace the RN react-query hooks (`use-dashboard`, `use-heatmap`,
/// `use-weight`) while preserving the SAME query-key tuples, staleness, retry
/// policy, and the one-request "bundle seeds the section caches" semantics.
///
/// Mapping:
///   - `useDashboard(userId, date)`  → [dashboardBundleProvider] (family).
///     Fetches `GET /api/v1/dashboard` once; the section providers below read
///     their slice off this result instead of firing their own request — the
///     Riverpod equivalent of the web's `queryClient.setQueryData` seeding.
///   - `useLoggingDay`              → [loggingDayProvider].
///   - `useWeightSummary('30d')`    → [weightSummaryProvider].
///   - `useHeatmap('90d')`          → [heatmapProvider].
///   - `useLogWeight()`             → [logWeight] (invalidates the bundle).
///
/// The screen gates all sections behind [dashboardBundleProvider], so by the
/// time the section providers are watched the bundle is already resolved — they
/// resolve synchronously from cache with no second round-trip.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/api_client.dart';
import '../../../data/query.dart';
import '../../../models/dashboard.dart';
import '../../../models/weight.dart';
import 'logging_day.dart';

/// The aggregate dashboard payload — `GET /api/v1/dashboard` decoded into its
/// four slices. Keyed by `(userId, date)`, like the RN
/// `['dashboard-bundle', userId, date, timezoneOffset]` query key.
class DashboardBundle {
  const DashboardBundle({
    required this.profile,
    required this.day,
    required this.weightSummary,
    required this.heatmap,
  });

  /// Nullable: a user who never finished onboarding has no profile row.
  final DashboardProfile? profile;
  final LoggingDayData day;
  final WeightSummaryData weightSummary;
  final HeatmapData heatmap;

  factory DashboardBundle.fromJson(Map<String, dynamic> json) =>
      DashboardBundle(
        profile: json['profile'] == null
            ? null
            : DashboardProfile.fromJson(
                json['profile'] as Map<String, dynamic>),
        day: LoggingDayData.fromJson(json['day'] as Map<String, dynamic>),
        weightSummary: WeightSummaryData.fromJson(
            json['weightSummary'] as Map<String, dynamic>),
        heatmap: HeatmapData.fromJson(json['heatmap'] as Map<String, dynamic>),
      );
}

/// Arguments for the bundle family — `(userId, date)`. The timezone offset is
/// derived inside the provider (same as the RN hook), so it is not part of the
/// family key but IS part of the request, matching the RN query key.
typedef DashboardArgs = ({String userId, String date});

/// Local timezone offset in MINUTES, matching JS `Date.getTimezoneOffset()`
/// (positive WEST of UTC). Dart's `timeZoneOffset` is positive EAST, so negate.
int localTimezoneOffsetMinutes() => -DateTime.now().timeZoneOffset.inMinutes;

/// `useDashboard` → one aggregate fetch for the whole screen.
final dashboardBundleProvider =
    FutureProvider.family<DashboardBundle, DashboardArgs>((ref, args) async {
  final api = ref.watch(apiClientProvider);
  final tz = localTimezoneOffsetMinutes();
  final date = Uri.encodeComponent(args.date);
  return runWithRetry(() async {
    final json = await api.get<Map<String, dynamic>>(
      '/api/v1/dashboard?date=$date&tz=$tz',
    );
    return DashboardBundle.fromJson(json);
  });
});

/// `useLoggingDay` → today's persisted meals. Reads the slice the bundle
/// already fetched (cache-seed parity). Keyed by `(userId, date)`.
final loggingDayProvider =
    FutureProvider.family<LoggingDayData, DashboardArgs>((ref, args) async {
  final bundle = await ref.watch(dashboardBundleProvider(args).future);
  return bundle.day;
});

/// Per-day meal slice for the dashboard's paged day-viewer.
///
/// Browsing a past day must NOT refetch the whole 90d heatmap + profile + weight
/// bundle just to swap the meal list. This hits the same lightweight
/// `GET /api/v1/logging/day` endpoint the logging surface uses and decodes only
/// the [LoggingDayData] (persistedMeals) slice the Today card renders. The
/// *anchor* day (today) still reads off the already-warm bundle so the first
/// page costs no extra round-trip; only swiping to another day fetches.
final dashboardDayProvider =
    FutureProvider.family<LoggingDayData, DashboardArgs>((ref, args) async {
  final api = ref.watch(apiClientProvider);
  final tz = localTimezoneOffsetMinutes();
  final date = Uri.encodeComponent(args.date);
  return runWithRetry(() async {
    final json = await api.get<Map<String, dynamic>>(
      '/api/v1/logging/day?date=$date&tz=$tz',
    );
    return LoggingDayData.fromJson(json);
  });
});

/// `useWeightSummary('30d')` → the 30-day weight summary slice. The mobile
/// chart is fixed at 30d (the section header shows the passive "30 days"
/// label), so this reads `bundle.weightSummary` directly.
final weightSummaryProvider =
    FutureProvider.family<WeightSummaryData, DashboardArgs>((ref, args) async {
  final bundle = await ref.watch(dashboardBundleProvider(args).future);
  return bundle.weightSummary;
});

/// `useHeatmap('90d')` → the adherence heatmap slice. Fixed at the 90-day
/// window (the range the web resolves to at phone width).
final heatmapProvider =
    FutureProvider.family<HeatmapData, DashboardArgs>((ref, args) async {
  final bundle = await ref.watch(dashboardBundleProvider(args).future);
  return bundle.heatmap;
});

/// `useLogWeight()` → logs (upserts) a day's weight via `POST /api/v1/weight`,
/// then invalidates the bundle (and thus every section that reads off it) so
/// the chart + weight card refetch — mirroring the RN broad
/// `weightSummaryKeys.all` invalidation. Throws [ApiError] on failure; the
/// caller surfaces `error.message`.
Future<void> logWeight(
  WidgetRef ref, {
  required DashboardArgs args,
  required String loggedDate,
  required double weightKg,
}) async {
  final api = ref.read(apiClientProvider);
  await api.post<dynamic>('/api/v1/weight', {
    'loggedDate': loggedDate,
    'weightKg': weightKg,
  });
  ref.invalidate(dashboardBundleProvider(args));
}
