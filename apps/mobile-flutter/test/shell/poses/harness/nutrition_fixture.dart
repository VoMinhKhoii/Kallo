import 'fixtures.dart';

Map<String, dynamic> nutritionFixture(PoseFixtures f) {
  const metrics = [
    ('calories', 'nutrition.macros.calories', 2030.0, 1961.0, 'kcal'),
    ('protein', 'nutrition.macros.protein', 140.0, 147.0, 'g'),
    ('carbohydrate', 'nutrition.macros.carbohydrate', 190.0, 172.0, 'g'),
    ('fat', 'nutrition.macros.fat', 68.0, 76.0, 'g'),
  ];
  final nutrients = [
    for (final n in [
      ('sodiumMg', 'sodium', 1850.0, 2000.0, 'mineral', 'mg', 'ceiling'),
      ('calciumMg', 'calcium', 820.0, 1000.0, 'mineral', 'mg', 'floor'),
      ('ironMg', 'iron', 12.0, 8.0, 'mineral', 'mg', 'floor'),
      ('vitaminCMg', 'vitaminC', 76.0, 90.0, 'vitamin', 'mg', 'floor'),
    ])
      {
        'nutrient': n.$1,
        'labelKey': 'nutrition.nutrients.${n.$2}',
        'averagePerDay': n.$3,
        'target': n.$4,
        'group': n.$5,
        'unit': n.$6,
        'nutrientType': n.$7,
        'targetSource': 'nasem',
        'targetSourceLabelKey': 'nutrition.targetSources.nasem',
        'percentOfTarget': n.$3 / n.$4 * 100,
        'confidence': 95.0,
        'displayState': 'normal',
      },
  ];
  return {
    'requestedRange': 'auto',
    'resolvedRange': '7d',
    'bucketTimezone': 'UTC',
    'loggedDays': 7,
    'completeDays': 6,
    'partialDays': 1,
    'loggedDaysLast30': 26,
    'trendStatus': 'ready',
    'period': {'startDate': f.date(6), 'endDate': f.date(0)},
    'summary': {
      'mostConsistent': <dynamic>[],
      'needsAttention': <dynamic>[],
      'limitedDataCount': 0,
      'macroConsistency': {
        'averageConsistencyPct': 86.0,
        'weakestMacro': 'fat',
      },
    },
    'calorieAverages': {
      'all': {'averagePerDay': 2030.0, 'days': 7},
      'complete': {'averagePerDay': 2100.0, 'days': 6},
    },
    'previousCalorieAverages': {
      'all': {'averagePerDay': 2180.0, 'days': 7},
      'complete': {'averagePerDay': 2210.0, 'days': 6},
    },
    'macros': [
      for (final m in metrics.skip(1))
        {
          'key': m.$1,
          'labelKey': m.$2,
          'averagePerDay': m.$3,
          'target': m.$4,
          'unit': m.$5,
          'consistencyPct': 86.0,
          'nutrientType': 'range',
        },
    ],
    'micronutrients': nutrients,
    'spotlight': [nutrients[1]],
    'steady': [nutrients[0], nutrients[2]],
    'moreNutrients': [nutrients[3]],
    'educationCards': <dynamic>[],
    'daySeries': {
      'unit': 'day',
      'series': [
        for (final m in metrics)
          {
            'metric': m.$1,
            'labelKey': m.$2,
            'unit': m.$5,
            'target': m.$4,
            'min': m.$3 * .9,
            'max': m.$3 * 1.1,
            'buckets': [
              for (var i = 6; i >= 0; i--)
                {
                  'startDate': f.date(i),
                  'endDate': f.date(i),
                  'value': m.$3 * (.9 + (i % 3) * .1),
                  'ratioOfTarget': m.$3 * (.9 + (i % 3) * .1) / m.$4,
                },
            ],
          },
      ],
    },
  };
}
