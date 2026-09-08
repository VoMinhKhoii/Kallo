/// The overview as the page reads it once a chart column may be selected.
library;

import '../../../models/nutrition/nutrition.dart';
import 'bucket_detail.dart';

/// Everything the nutrition screen derives from one overview plus the tapped
/// chart column, resolved in one pass.
///
/// Selecting a column re-points the WHOLE page at that bucket — the calorie
/// hero, the gram legend, the nutrient grid and the date span all read the
/// bucket instead of the range — so the resolution is one decision with seven
/// consequences, not seven independent ones scattered through a build method.
class OverviewSelection {
  const OverviewSelection({
    required this.active,
    required this.macros,
    required this.vitamins,
    required this.minerals,
    required this.buckets,
    required this.dateSpan,
    required this.todayIndex,
  });

  /// Resolve [overview] against the tapped column, if any.
  ///
  /// [today] defaults to the local date the server buckets by; pass it
  /// explicitly to keep a test deterministic.
  factory OverviewSelection.resolve(
    NutritionOverview overview, {
    required int? selectedIndex,
    required String locale,
    String? today,
  }) {
    // `active`, not `selectedIndex`: tapping a column with nothing logged in
    // it resolves to no detail, and the page stays on the range rather than
    // greying every other column around an empty one.
    final detail =
        selectedIndex == null
            ? null
            : buildBucketDetail(overview.daySeries, selectedIndex);
    final all = [...overview.micronutrients, ...overview.moreNutrients];
    final cards = detail == null ? all : scopeCardsToBucket(all, detail);
    final buckets =
        overview.daySeries.series.isEmpty
            ? const <DaySeriesBucket>[]
            : overview.daySeries.series.first.buckets;
    return OverviewSelection(
      active: detail == null ? null : selectedIndex,
      macros:
          detail == null
              ? overview.macros
              : scopeMacrosToBucket(overview.macros, detail),
      vitamins: cards.where((c) => c.group == NutrientGroup.vitamin).toList(),
      minerals: cards.where((c) => c.group != NutrientGroup.vitamin).toList(),
      buckets: buckets,
      dateSpan:
          detail == null
              ? formatDateSpan(
                overview.period.startDate,
                overview.period.endDate,
                locale,
              )
              : formatDateSpan(detail.startDate, detail.endDate, locale),
      todayIndex: findTodayIndex(buckets, today ?? localIsoDate()),
    );
  }

  /// The selected column, or null when nothing is selected AND when the tap
  /// resolved to a bucket with nothing in it.
  final int? active;

  /// The macro figures, scoped to the selected bucket when there is one.
  final List<MacroPattern> macros;

  /// Every displayed nutrient card, split by the two groups the page heads.
  final List<NutrientCardData> vitamins;
  final List<NutrientCardData> minerals;

  /// The charted buckets of the first series — the chart's own x axis.
  final List<DaySeriesBucket> buckets;

  /// The heading's date span: the whole period, or the selected bucket.
  final String dateSpan;

  /// Index of the bucket holding today, or -1.
  final int todayIndex;
}
