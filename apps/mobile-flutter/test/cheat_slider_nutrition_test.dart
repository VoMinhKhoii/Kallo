// Dart port of the client-side cases in
// `lib/cheat/__tests__/slider-nutrition.test.ts` — the slider→nutrition math
// must stay in lockstep with the web/server implementation
// (`lib/cheat/slider-nutrition.ts`), which recomputes authoritatively on
// confirm. (canonicalizeAnchors/withLevelsAsDefaults are server-only and have
// no Dart port.)
import 'package:flutter_test/flutter_test.dart';
import 'package:nham_mobile/features/logging/logic/slider_nutrition.dart';
import 'package:nham_mobile/models/cheat.dart';

CheatSliderSpec makeSpec() => const CheatSliderSpec(
  mealSlot: 'dinner',
  confidence: 'medium',
  sliders: [
    CheatSlider(
      key: CheatSliderKey.protein,
      label: 'Thịt / hải sản',
      defaultLevel: 5,
      anchors: [
        CheatSliderAnchor(level: 0, label: 'không ăn thịt', proteinG: 0),
        CheatSliderAnchor(
          level: 5,
          label: 'phần BBQ bình thường',
          proteinG: 60,
        ),
        CheatSliderAnchor(level: 10, label: 'tiệc thịt', proteinG: 120),
      ],
    ),
    CheatSlider(
      key: CheatSliderKey.carbs,
      label: 'Cơm / mì',
      defaultLevel: 3,
      anchors: [
        CheatSliderAnchor(level: 0, label: 'bỏ cơm', carbohydrateG: 0),
        CheatSliderAnchor(
          level: 10,
          label: 'nhiều cơm + mì',
          carbohydrateG: 150,
        ),
      ],
    ),
    CheatSlider(
      key: CheatSliderKey.fat,
      label: 'Độ béo',
      defaultLevel: 5,
      anchors: [
        CheatSliderAnchor(level: 0, label: 'thịt nạc, nướng', fatG: 0),
        CheatSliderAnchor(level: 5, label: 'ba chỉ + đồ chiên', fatG: 40),
        CheatSliderAnchor(level: 10, label: 'mỡ + chiên + kem', fatG: 90),
      ],
    ),
    CheatSlider(
      key: CheatSliderKey.drinks,
      label: 'Đồ uống',
      defaultLevel: 0,
      anchors: [
        CheatSliderAnchor(
          level: 0,
          label: 'không uống',
          carbohydrateG: 0,
          alcoholG: 0,
        ),
        CheatSliderAnchor(
          level: 10,
          label: 'nước ngọt + vài lon bia',
          carbohydrateG: 50,
          alcoholG: 40,
        ),
      ],
    ),
  ],
);

void main() {
  group('clampLevel', () {
    test('clamps out-of-range and non-finite values', () {
      expect(clampLevel(-3), 0);
      expect(clampLevel(15), 10);
      expect(clampLevel(double.nan), 0);
      expect(clampLevel(double.infinity), 0);
      expect(clampLevel(4), 4);
    });
  });

  group('defaultLevels', () {
    test('reads each slider defaultLevel', () {
      expect(defaultLevels(makeSpec()), {
        CheatSliderKey.protein: 5,
        CheatSliderKey.carbs: 3,
        CheatSliderKey.fat: 5,
        CheatSliderKey.drinks: 0,
      });
    });
  });

  group('resolveSliderNutrition', () {
    test('sums orthogonal axes and derives calories with the 4/4/9/7 identity',
        () {
      final result = resolveSliderNutrition(makeSpec(), {
        CheatSliderKey.protein: 5, // 60g
        CheatSliderKey.carbs: 0, // 0g
        CheatSliderKey.fat: 5, // 40g
        CheatSliderKey.drinks: 0, // none
      });
      expect(result.proteinG, 60);
      expect(result.carbohydrateG, 0);
      expect(result.fatG, 40);
      expect(result.alcoholG, 0);
      // 4*60 + 4*0 + 9*40 + 7*0 = 240 + 360 = 600
      expect(result.caloriesKcal, 600);
    });

    test('interpolates linearly between sparse anchors', () {
      // carbs at level 5 → halfway between 0g (L0) and 150g (L10) = 75g
      final result = resolveSliderNutrition(makeSpec(), {
        CheatSliderKey.carbs: 5,
      });
      expect(result.carbohydrateG, 75);
    });

    test('folds drink sugar into carbs and counts alcohol energy', () {
      final result = resolveSliderNutrition(makeSpec(), {
        CheatSliderKey.protein: 0,
        CheatSliderKey.carbs: 0,
        CheatSliderKey.fat: 0,
        CheatSliderKey.drinks: 10, // +50g carbs, +40g alcohol
      });
      expect(result.carbohydrateG, 50);
      expect(result.alcoholG, 40);
      // 4*50 + 7*40 = 200 + 280 = 480
      expect(result.caloriesKcal, 480);
    });

    test('falls back to defaultLevel when a level is omitted', () {
      final spec = makeSpec();
      final withDefaults = resolveSliderNutrition(spec, {});
      final explicit = resolveSliderNutrition(spec, defaultLevels(spec));
      expect(withDefaults.proteinG, explicit.proteinG);
      expect(withDefaults.carbohydrateG, explicit.carbohydrateG);
      expect(withDefaults.fatG, explicit.fatG);
      expect(withDefaults.alcoholG, explicit.alcoholG);
      expect(withDefaults.caloriesKcal, explicit.caloriesKcal);
    });

    test('clamps levels beyond the anchor span to edge values', () {
      final result = resolveSliderNutrition(makeSpec(), {
        CheatSliderKey.protein: 99,
      });
      expect(result.proteinG, 120);
    });

    test('rounds each axis to one decimal before the calorie identity', () {
      // protein at level 1 → 60 * (1/5) = 12g exactly; level 1.25 → 15g.
      // Use a third (0.333...) to exercise rounding: level 5/3 → 20g.
      final result = resolveSliderNutrition(makeSpec(), {
        CheatSliderKey.protein: 5 / 3,
        CheatSliderKey.carbs: 0,
        CheatSliderKey.fat: 0,
        CheatSliderKey.drinks: 0,
      });
      expect(result.proteinG, 20);
      expect(result.caloriesKcal, 80);
    });
  });

  group('activeAnchorLabel', () {
    test('returns the nearest anchor label at or below the level', () {
      final protein = makeSpec().sliders[0];
      expect(activeAnchorLabel(protein, 0), 'không ăn thịt');
      expect(activeAnchorLabel(protein, 4), 'không ăn thịt');
      expect(activeAnchorLabel(protein, 5), 'phần BBQ bình thường');
      expect(activeAnchorLabel(protein, 9), 'phần BBQ bình thường');
      expect(activeAnchorLabel(protein, 10), 'tiệc thịt');
    });

    test('returns empty string for an anchorless slider', () {
      const slider = CheatSlider(
        key: CheatSliderKey.protein,
        label: 'x',
        defaultLevel: 0,
        anchors: [],
      );
      expect(activeAnchorLabel(slider, 5), '');
    });
  });
}
