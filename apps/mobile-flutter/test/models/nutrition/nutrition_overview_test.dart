// `micronutrientsLocked` parsing.
//
// The server sets the flag and ALREADY empties the premium sections on the same
// response; the client only has to learn whether to show the upsell in their
// place. A server that predates the gate omits the field entirely, so the
// absent case must read false rather than locking a working app.
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/models/nutrition/nutrition.dart';

Map<String, dynamic> overviewJson({Object? micronutrientsLocked = _absent}) => {
  'requestedRange': '7d',
  'resolvedRange': '7d',
  'bucketTimezone': 'Asia/Ho_Chi_Minh',
  'loggedDays': 3,
  'completeDays': 2,
  'partialDays': 1,
  'loggedDaysLast30': 12,
  'trendStatus': 'ok',
  'period': {'startDate': '2026-08-01', 'endDate': '2026-08-07'},
  'summary': {
    'mostConsistent': <dynamic>[],
    'needsAttention': <dynamic>[],
    'limitedDataCount': 0,
    'macroConsistency': {'averageConsistencyPct': 0, 'weakestMacro': null},
  },
  'calorieAverages': {
    'all': {'averagePerDay': 1800.0, 'days': 3},
    'complete': {'averagePerDay': 2000.0, 'days': 2},
  },
  'macros': <dynamic>[],
  'micronutrients': <dynamic>[],
  'spotlight': <dynamic>[],
  'steady': <dynamic>[],
  'moreNutrients': <dynamic>[],
  'educationCards': <dynamic>[],
  'daySeries': {'unit': 'day', 'series': <dynamic>[]},
  if (micronutrientsLocked != _absent)
    'micronutrientsLocked': micronutrientsLocked,
};

const Object _absent = Object();

void main() {
  group('NutritionOverview.micronutrientsLocked', () {
    test('reads true when the server locks the premium sections', () {
      final o = NutritionOverview.fromJson(
        overviewJson(micronutrientsLocked: true),
      );
      expect(o.micronutrientsLocked, isTrue);
      // Calories and macros survive the lock — only the detail is premium.
      expect(o.calorieAverages.complete.averagePerDay, 2000.0);
    });

    test('an old payload without the field parses as unlocked', () {
      final o = NutritionOverview.fromJson(overviewJson());
      expect(o.micronutrientsLocked, isFalse);
    });

    test('a non-boolean value is treated as unlocked, not as truthy', () {
      final o = NutritionOverview.fromJson(
        overviewJson(micronutrientsLocked: 'true'),
      );
      expect(o.micronutrientsLocked, isFalse);
    });

    test('survives a toJson / fromJson round trip', () {
      final o = NutritionOverview.fromJson(
        overviewJson(micronutrientsLocked: true),
      );
      expect(
        NutritionOverview.fromJson(o.toJson()).micronutrientsLocked,
        isTrue,
      );
    });
  });
}
