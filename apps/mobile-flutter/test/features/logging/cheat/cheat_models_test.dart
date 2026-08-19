// Decode regressions for the cheat-meal wire shapes: a cheat pending entry
// carries `cheatSpec` and NO `parsedMeal` (this used to crash the whole
// day decode), a persisted cheat meal carries entryMode/alcoholG/cheatSliders,
// and the `cheat_estimate` SSE frame parses (incl. the clarify variant).
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/logging/data/logging_models.dart';
import 'package:kallo_mobile/models/logging/cheat.dart';
import 'package:kallo_mobile/models/profile/dashboard.dart';
import 'package:kallo_mobile/models/logging/streaming.dart';

Map<String, dynamic> specJson({bool clarify = false}) => {
  'sliders': [
    {
      'key': 'protein',
      'label': 'Thịt',
      'defaultLevel': 5,
      'anchors': [
        {'level': 0, 'label': 'none', 'proteinG': 0},
        {'level': 10, 'label': 'feast', 'proteinG': 120},
      ],
    },
    {
      'key': 'drinks',
      'label': 'Đồ uống',
      'defaultLevel': 2,
      'anchors': [
        {'level': 0, 'label': 'none', 'carbohydrateG': 0, 'alcoholG': 0},
        {'level': 10, 'label': 'lots', 'carbohydrateG': 50, 'alcoholG': 40},
      ],
    },
  ],
  'mealSlot': 'dinner',
  'confidence': 'medium',
  if (clarify)
    'clarifyingQuestion': {
      'prompt': 'Tiệc kiểu gì?',
      'options': ['BBQ', 'Lẩu'],
    },
};

void main() {
  group('LoggingDayData decode', () {
    test('a cheat pending entry (no parsedMeal) decodes instead of crashing',
        () {
      final day = LoggingDayData.fromJson({
        'persistedMeals': <dynamic>[],
        'pendingConfirmations': [
          {
            'id': 'a5a4dcd0-8a3f-4b58-b41f-3c1de2f0a111',
            'rawInput': 'Buffet nướng Hàn',
            'loggedAt': '2026-07-10T12:00:00.000Z',
            'cheatSpec': specJson(),
          },
        ],
      });
      final pending = day.pendingConfirmations.single;
      expect(pending.parsedMeal, isNull);
      expect(pending.cheatSpec, isNotNull);
      expect(pending.cheatSpec!.sliders, hasLength(2));
      expect(pending.cheatSpec!.sliders.first.key, CheatSliderKey.protein);
      expect(pending.cheatSpec!.sliders.last.anchors.last.alcoholG, 40);
    });

    test('a persisted cheat meal decodes entryMode/alcoholG/cheatSliders', () {
      final meal = PersistedMeal.fromJson({
        'id': 'f7e6d5c4-b3a2-4190-8f7e-6d5c4b3a2190',
        'rawInput': 'Buffet nướng Hàn',
        'loggedAt': '2026-07-10T12:00:00.000Z',
        'nutrition': {
          'caloriesKcal': 980,
          'proteinG': 60,
          'carbohydrateG': 50,
          'fatG': 40,
        },
        'mealItemGroups': <dynamic>[],
        'entryMode': 'cheat',
        'alcoholG': 20,
        'cheatSliders': {
          'spec': specJson(),
          'levels': {'protein': 6, 'drinks': 4},
        },
      });
      expect(meal.isCheat, isTrue);
      expect(meal.alcoholG, 20);
      expect(meal.cheatSliders, isNotNull);
      expect(meal.cheatSliders!.levels[CheatSliderKey.protein], 6);
      expect(meal.cheatSliders!.levels[CheatSliderKey.drinks], 4);
    });

    test('a precise meal defaults to entryMode precise', () {
      final meal = PersistedMeal.fromJson({
        'id': 'f7e6d5c4-b3a2-4190-8f7e-6d5c4b3a2190',
        'rawInput': 'phở bò',
        'loggedAt': '2026-07-10T12:00:00.000Z',
        'nutrition': {'caloriesKcal': 450},
        'mealItemGroups': <dynamic>[],
      });
      expect(meal.isCheat, isFalse);
      expect(meal.entryMode, 'precise');
      expect(meal.cheatSliders, isNull);
    });
  });

  group('StreamEvent cheat_estimate', () {
    test('parses a full spec frame', () {
      final event = StreamEvent.fromJson({
        'type': 'cheat_estimate',
        'spec': specJson(),
      });
      expect(event, isA<CheatEstimateEvent>());
      final spec = (event as CheatEstimateEvent).spec;
      expect(spec.clarifyingQuestion, isNull);
      expect(spec.sliders, hasLength(2));
    });

    test('parses the clarifying-question variant', () {
      final event = StreamEvent.fromJson({
        'type': 'cheat_estimate',
        'spec': specJson(clarify: true),
      });
      final spec = (event as CheatEstimateEvent).spec;
      expect(spec.clarifyingQuestion, isNotNull);
      expect(spec.clarifyingQuestion!.prompt, 'Tiệc kiểu gì?');
      expect(spec.clarifyingQuestion!.options, ['BBQ', 'Lẩu']);
    });
  });

  group('HeatmapCell', () {
    test('parses hasCheatMeal and defaults it to false', () {
      final cheat = HeatmapCell.fromJson({
        'date': '2026-07-09',
        'ratio': null,
        'consumedRatio': 1.4,
        'status': 'logged',
        'hasCheatMeal': true,
      });
      expect(cheat.hasCheatMeal, isTrue);

      final plain = HeatmapCell.fromJson({
        'date': '2026-07-08',
        'ratio': 0.9,
        'consumedRatio': 0.9,
        'status': 'logged',
      });
      expect(plain.hasCheatMeal, isFalse);
    });
  });

  group('cheat levels wire round-trip', () {
    test('serializes wire-keyed and parses back', () {
      final levels = {CheatSliderKey.fat: 7.0, CheatSliderKey.carbs: 2.0};
      final wire = cheatLevelsToWire(levels);
      expect(wire, {'fat': 7.0, 'carbs': 2.0});
      expect(cheatLevelsFromWire(wire), levels);
    });
  });
}
