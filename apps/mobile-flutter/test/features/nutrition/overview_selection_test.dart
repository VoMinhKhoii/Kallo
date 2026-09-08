import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'package:kallo_mobile/features/nutrition/logic/bucket_detail.dart';
import 'package:kallo_mobile/features/nutrition/logic/overview_selection.dart';
import 'package:kallo_mobile/models/nutrition/nutrition.dart';

/// [OverviewSelection] is the block the nutrition screen used to inline: the
/// same resolution of one overview against the tapped chart column, asserted
/// against the helpers it composes so the move stays a move.
NutrientCardData _card(
  NutritionNutrientKey nutrient,
  NutrientGroup group,
  double value,
) => NutrientCardData(
  nutrient: nutrient,
  labelKey: 'nutrition.nutrients.${nutrient.name}',
  group: group,
  averagePerDay: value,
  target: 100,
  targetSource: TargetSource.nasem,
  targetSourceLabelKey: 'nutrition.targetSources.nasem',
  unit: 'mg',
  percentOfTarget: value,
  confidence: 100,
  displayState: ConfidenceDisplayState.normal,
  nutrientType: NutrientType.floor,
);

NutrientDaySeries _series(String metric, List<double?> values) =>
    NutrientDaySeries(
      metric: metric,
      labelKey: 'nutrition.macros.$metric',
      unit: 'g',
      target: 100,
      buckets: [
        for (var i = 0; i < values.length; i++)
          DaySeriesBucket(
            startDate: '2026-08-1$i',
            endDate: '2026-08-1$i',
            value: values[i],
            ratioOfTarget: values[i] == null ? null : values[i]! / 100,
          ),
      ],
      min: null,
      max: null,
    );

/// Three day buckets: two logged, the third (index 2) empty on every metric.
final _overview = NutritionOverview(
  requestedRange: 'auto',
  resolvedRange: '7d',
  bucketTimezone: 'Asia/Ho_Chi_Minh',
  loggedDays: 2,
  completeDays: 2,
  partialDays: 0,
  loggedDaysLast30: 2,
  trendStatus: 'steady',
  period: (startDate: '2026-08-10', endDate: '2026-08-12'),
  summary: const NutritionSummary(
    mostConsistent: [],
    needsAttention: [],
    limitedDataCount: 0,
    macroConsistency: MacroConsistencySummary(
      averageConsistencyPct: 80,
      weakestMacro: null,
    ),
  ),
  calorieAverages: const CalorieAverages(
    all: CalorieScopeAverage(averagePerDay: 1800, days: 2),
    complete: CalorieScopeAverage(averagePerDay: 2000, days: 2),
  ),
  previousCalorieAverages: const CalorieAverages(
    all: CalorieScopeAverage(averagePerDay: null, days: 0),
    complete: CalorieScopeAverage(averagePerDay: null, days: 0),
  ),
  macros: const [
    MacroPattern(
      key: 'calories',
      labelKey: 'nutrition.macros.calories',
      averagePerDay: 1900,
      target: 2000,
      unit: 'kcal',
      consistencyPct: 70,
      nutrientType: NutrientType.range,
    ),
    MacroPattern(
      key: 'protein',
      labelKey: 'nutrition.macros.protein',
      averagePerDay: 90,
      target: 100,
      unit: 'g',
      consistencyPct: 60,
      nutrientType: NutrientType.floor,
    ),
  ],
  micronutrients: [
    _card(NutritionNutrientKey.vitaminAMcg, NutrientGroup.vitamin, 70),
  ],
  spotlight: const [],
  steady: const [],
  moreNutrients: [
    _card(NutritionNutrientKey.sodiumMg, NutrientGroup.mineral, 80),
  ],
  educationCards: const [],
  daySeries: NutritionDaySeries(
    unit: 'day',
    series: [
      _series('calories', [1800, 2000, null]),
      _series('protein', [80, 100, null]),
      _series('vitaminAMcg', [60, 80, null]),
      _series('sodiumMg', [70, 90, null]),
    ],
  ),
);

void main() {
  const today = '2026-08-11';

  setUpAll(() async {
    await initializeDateFormatting('en');
  });

  OverviewSelection resolve(int? index) => OverviewSelection.resolve(
    _overview,
    selectedIndex: index,
    locale: 'en',
    today: today,
  );

  test('nothing selected reads the whole range', () {
    final view = resolve(null);

    expect(view.active, isNull);
    expect(view.macros, same(_overview.macros));
    expect(view.vitamins.map((c) => c.nutrient), [
      NutritionNutrientKey.vitaminAMcg,
    ]);
    expect(view.minerals.map((c) => c.nutrient), [
      NutritionNutrientKey.sodiumMg,
    ]);
    expect(view.dateSpan, formatDateSpan('2026-08-10', '2026-08-12', 'en'));
    expect(view.buckets, _overview.daySeries.series.first.buckets);
    expect(view.todayIndex, 1);
  });

  test('a selected column re-points every figure at that bucket', () {
    final view = resolve(1);
    final detail = buildBucketDetail(_overview.daySeries, 1)!;

    expect(view.active, 1);
    // The same values the helpers the screen used to call inline produce.
    expect(
      view.macros.map((m) => m.averagePerDay),
      scopeMacrosToBucket(_overview.macros, detail).map((m) => m.averagePerDay),
    );
    expect(view.macros.map((m) => m.averagePerDay), [2000, 100]);
    expect(view.macros.every((m) => m.consistencyPct == null), isTrue);
    expect(view.vitamins.single.averagePerDay, 80);
    expect(view.minerals.single.averagePerDay, 90);
    expect(view.dateSpan, formatDateSpan('2026-08-11', '2026-08-11', 'en'));
  });

  test('a column with nothing logged in it stays on the range', () {
    final view = resolve(2);

    expect(buildBucketDetail(_overview.daySeries, 2), isNull);
    expect(view.active, isNull);
    expect(view.macros, same(_overview.macros));
    expect(view.vitamins.single.averagePerDay, 70);
    expect(view.dateSpan, formatDateSpan('2026-08-10', '2026-08-12', 'en'));
  });
}
