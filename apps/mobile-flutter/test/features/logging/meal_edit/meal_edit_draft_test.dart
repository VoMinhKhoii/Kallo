import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/logging/data/logging_models.dart';
import 'package:kallo_mobile/features/logging/logic/meal_edit/meal_edit_sources.dart';
import 'package:kallo_mobile/features/logging/logic/meal_utils.dart';
import 'package:kallo_mobile/models/logging/meal.dart';
import 'package:kallo_mobile/models/nutrition/vessel.dart';

PersistedIngredient ing(
  String id, {
  double? grams,
  double? kcal,
  double? p,
  String unit = 'g',
}) => PersistedIngredient(
  id: id,
  ingredientName: id,
  estimatedGrams: grams,
  userFacingUnit: unit,
  nutrition: MealNutrition(caloriesKcal: kcal, proteinG: p),
);

PersistedMealItemGroup dish(int order, List<PersistedIngredient> parts) =>
    PersistedMealItemGroup(
      name: 'dish $order',
      order: order,
      nutrition: const MealNutrition(),
      ingredients: parts,
    );

PersistedMeal meal(List<PersistedMealItemGroup> groups) => PersistedMeal(
  id: 'm',
  rawInput: 'lunch',
  loggedAt: '2026-10-23T12:00:00Z',
  nutrition: const MealNutrition(),
  mealItemGroups: groups,
);

MealItem item(String id, double grams, double kcal, {ClientVessel? vessel}) =>
    MealItem(
      id: id,
      name: id,
      quantity: grams,
      unit: 'g',
      macros: MacroBreakdown(calories: kcal, protein: 10, carbs: 20, fat: 5),
      vessel: vessel,
    );

void main() {
  final bowl = meal([
    dish(0, [
      ing('rice', grams: 200, kcal: 260, p: 5),
      ing('chicken', grams: 150, kcal: 250, p: 40),
    ]),
    dish(1, [ing('latte', grams: 350, kcal: 190, p: 12, unit: 'ml')]),
  ]);

  group('servings', () {
    test('plus doubles a dish and scales every part with it', () {
      final d = draftFromPersisted(
        bowl,
      ).stepServings('0:dish 0', 1).stepServings('0:dish 0', 1);
      expect(d.dish('0:dish 0')!.servings, 2);
      expect(d.dish('0:dish 0')!.grams, 700);
      expect(d.totals.kcal, 2 * 510 + 190);
      expect(d.totals.protein, 2 * 45 + 12);
    });

    test('an off-step amount snaps to the next half, both ways', () {
      final d = draftFromPersisted(
        bowl,
      ).stepAmount('0:dish 0', 1).stepAmount('0:dish 0', 1);
      expect(d.dish('0:dish 0')!.grams, 370); // 1.06×
      expect(d.stepServings('0:dish 0', 1).dish('0:dish 0')!.servings, 1.5);
      expect(d.stepServings('0:dish 0', -1).dish('0:dish 0')!.servings, 1);
    });

    test('minus at a quarter serving removes the dish on a saved meal', () {
      var d = draftFromPersisted(bowl);
      final steps = <double>[];
      for (var i = 0; i < 5; i++) {
        d = d.stepServings('1:dish 1', -1);
        steps.add(d.dish('1:dish 1')!.servings);
      }
      expect(steps, [0.75, 2 / 3, 0.5, 1 / 3, 0.25]);
      expect(d.removesOnMinus(d.dish('1:dish 1')!), isTrue);
      expect(d.stepServings('1:dish 1', -1).dish('1:dish 1'), isNull);
    });

    test('the last dish can never be removed', () {
      var one = draftFromPersisted(meal([bowl.mealItemGroups[1]]));
      for (var i = 0; i < 5; i++) {
        one = one.stepServings('1:dish 1', -1);
      }
      expect(one.removesOnMinus(one.dish('1:dish 1')!), isFalse);
      expect(one.servingsMinusDisabled(one.dish('1:dish 1')!), isTrue);
      expect(one.stepServings('1:dish 1', -1).dish('1:dish 1')!.servings, 0.25);
    });

    test(
      'a per-serving logged food scales down by Servings and Whole meal',
      () {
        final wontons = meal([
          dish(0, [
            ing('wontons', grams: 1, kcal: 210, p: 13, unit: 'serving'),
          ]),
        ]);
        final opened = draftFromPersisted(wontons);
        expect(opened.dish('0:dish 0')!.unit, 'serving');
        final half = opened.stepWhole(-1).stepWhole(-1).stepWhole(-1);
        expect(half.whole, 0.5);
        expect(half.dish('0:dish 0')!.grams, closeTo(0.5, 1e-9));
        expect(half.totals.kcal, closeTo(105, 1e-9));
        expect(persistedEditFrom(wontons, half).edits, [
          {'id': 'wontons', 'newGrams': 0.5},
        ]);
        final third = half.stepWhole(-1);
        expect(third.totals.kcal, closeTo(70, 1e-9));
        expect(persistedEditFrom(wontons, third).edits, [
          {'id': 'wontons', 'newGrams': 0.333},
        ]);
      },
    );
  });

  group('amount', () {
    test('steps ten at a time and floors at the minimum', () {
      final d = draftFromPersisted(
        meal([
          dish(0, [ing('salt', grams: 15)]),
        ]),
      );
      expect(d.stepAmount('0:dish 0', 1).dish('0:dish 0')!.grams, 25);
      expect(d.stepAmount('0:dish 0', -1).dish('0:dish 0')!.grams, 10);
    });

    test('reads in ml only when every weighed part is ml', () {
      final d = draftFromPersisted(bowl);
      expect(d.dish('0:dish 0')!.unit, 'g');
      expect(d.dish('1:dish 1')!.unit, 'ml');
    });

    test(
      'disables Amount minus when Whole meal thirds land at the floor with float drift',
      () {
        final m = meal([
          dish(0, [ing('dip', grams: 30)]),
        ]);
        var d = draftFromPersisted(m);
        for (var i = 0; i < 4; i++) {
          d = d.stepWhole(-1); // 0.75 → 2/3 → 0.5 → 1/3 (≈10g)
        }
        expect(d.dish('0:dish 0')!.amountMinusDisabled, isTrue);
      },
    );
  });

  group('whole meal', () {
    test('scales every dish along the serving ladder and stops at 0.25×', () {
      final d = draftFromPersisted(bowl).stepWhole(1);
      expect(d.whole, 1.5);
      expect(d.dish('0:dish 0')!.grams, 525);
      expect(d.dish('1:dish 1')!.grams, 525);
      var cur = d;
      for (var i = 0; i < 8; i++) {
        cur = cur.stepWhole(-1);
      }
      expect(cur.whole, 0.25);
      expect(cur.dish('0:dish 0')!.grams, closeTo(87.5, 1e-9));
    });
  });

  group('nulls are not zero', () {
    test('a macro no part carries stays null', () {
      final d = draftFromPersisted(
        meal([
          dish(0, [ing('x', grams: 100)]),
        ]),
      );
      expect(d.totals.kcal, isNull);
    });

    test('a part with no grams keeps its nutrition as the dish scales', () {
      final d = draftFromPersisted(
        meal([
          dish(0, [
            ing('weighed', grams: 100, kcal: 100),
            ing('legacy', kcal: 50),
          ]),
        ]),
      ).stepServings('0:dish 0', 1).stepServings('0:dish 0', 1);
      expect(d.totals.kcal, 250);
    });

    test('a zero-gram row is held like a missing one, preview and save', () {
      final m = meal([
        dish(0, [
          ing('weighed', grams: 100, kcal: 100),
          ing('zero', grams: 0, kcal: 50),
        ]),
      ]);
      final d = draftFromPersisted(
        m,
      ).stepServings('0:dish 0', 1).stepServings('0:dish 0', 1);
      expect(d.totals.kcal, 250); // the 0 g row's 50 kcal does not double
      expect(persistedEditFrom(m, d).edits, [
        {'id': 'weighed', 'newGrams': 200.0},
      ]);
    });

    test('a dish with no grams at all cannot be stepped', () {
      final d = draftFromPersisted(
        meal([
          dish(0, [ing('legacy', kcal: 50)]),
        ]),
      );
      expect(d.dish('0:dish 0')!.scalable, isFalse);
      expect(d.stepServings('0:dish 0', 1).totals.kcal, 50);
    });
  });

  group('saved payload', () {
    test('nothing changed sends nothing', () {
      final out = persistedEditFrom(bowl, draftFromPersisted(bowl));
      expect(out.edits, isEmpty);
      expect(out.removeIds, isEmpty);
    });

    test('a resized dish sends every weighed row; a removed one its ids', () {
      var draft = draftFromPersisted(bowl).stepServings('0:dish 0', 1);
      for (var i = 0; i < 6; i++) {
        draft = draft.stepServings('1:dish 1', -1);
      }
      final out = persistedEditFrom(bowl, draft);
      expect(out.edits, [
        {'id': 'rice', 'newGrams': 300.0},
        {'id': 'chicken', 'newGrams': 225.0},
      ]);
      expect(out.removeIds, ['latte']);
    });

    test('a tiny part keeps a positive amount', () {
      final m = meal([
        dish(0, [ing('rice', grams: 200), ing('salt', grams: 0.01)]),
      ]);
      var d = draftFromPersisted(m);
      for (var i = 0; i < 3; i++) {
        d = d.stepServings('0:dish 0', -1); // 0.5×
      }
      final out = persistedEditFrom(m, d);
      expect(out.edits, [
        {'id': 'rice', 'newGrams': 100.0},
      ]); // the salt stays at its 0.01 g floor rather than rounding to 0
    });
  });

  group('dish identity', () {
    test('two dishes that share an order stay apart', () {
      PersistedMealItemGroup twin(String name, String id) =>
          PersistedMealItemGroup(
            name: name,
            order: 0,
            nutrition: const MealNutrition(),
            ingredients: [ing(id, grams: 100, kcal: 100)],
          );
      final m = meal([twin('Rice', 'rice'), twin('Soup', 'soup')]);
      var d = draftFromPersisted(m);
      for (var i = 0; i < 6; i++) {
        d = d.stepServings('0:Rice', -1);
      }
      expect(d.dish('0:Rice'), isNull);
      expect(d.dish('0:Soup')!.grams, 100);
      final out = persistedEditFrom(m, d);
      expect(out.edits, isEmpty);
      expect(out.removeIds, ['rice']);
    });
  });

  group('review round 1', () {
    test('a dish logged under the floor opens and saves as logged', () {
      final m = meal([
        dish(0, [ing('rice', grams: 200, kcal: 260)]),
        dish(1, [ing('butter', grams: 5, kcal: 36)]),
      ]);
      final d = draftFromPersisted(m);
      expect(d.dish('1:dish 1')!.grams, 5);
      expect(d.totals.kcal, 296);
      expect(persistedEditFrom(m, d).edits, isEmpty);
      // Its own floor is what it was logged at, so Amount minus does nothing.
      expect(d.dish('1:dish 1')!.floor, 5);
      expect(d.stepAmount('1:dish 1', -1).dish('1:dish 1')!.grams, 5);
    });

    test('half servings step from an off-step amount to the NEAREST half', () {
      final d = draftFromPersisted(bowl); // dish 0 is 350 g
      final off = d.setGrams('0:dish 0', 360); // 1.03×
      expect(off.stepServings('0:dish 0', -1).dish('0:dish 0')!.servings, 1);
      final high = d.setGrams('0:dish 0', 516.25); // 1.475×
      expect(high.stepServings('0:dish 0', 1).dish('0:dish 0')!.servings, 1.5);
    });

    test('a small dish scales down through quarters and removes at 0.25×', () {
      final m = meal([
        dish(0, [ing('rice', grams: 200)]),
        dish(1, [ing('sauce', grams: 15)]),
      ]);
      var d = draftFromPersisted(m);
      for (var i = 0; i < 5; i++) {
        d = d.stepServings('1:dish 1', -1);
      }
      expect(d.dish('1:dish 1')!.grams, closeTo(3.75, 1e-9));
      expect(d.removesOnMinus(d.dish('1:dish 1')!), isTrue);
      expect(d.stepServings('1:dish 1', -1).dish('1:dish 1'), isNull);
    });

    test('a dish with no grams can be removed but not grown', () {
      final m = meal([
        dish(0, [ing('rice', grams: 200)]),
        dish(1, [ing('legacy', kcal: 50)]),
      ]);
      final d = draftFromPersisted(m);
      expect(d.removesOnMinus(d.dish('1:dish 1')!), isTrue);
      expect(d.stepServings('1:dish 1', 1).dish('1:dish 1')!.servings, 1);
      expect(d.stepServings('1:dish 1', -1).dish('1:dish 1'), isNull);
    });

    test(
      'Whole meal down then up restores a dish that hit the minimum floor',
      () {
        final m = meal([
          dish(0, [ing('rice', grams: 200)]),
          dish(1, [ing('spice', grams: 0.02)]),
        ]);
        var d = draftFromPersisted(m);
        for (var i = 0; i < 5; i++) {
          d = d.stepWhole(-1); // 0.25× → 0.005 clamped to 0.01
        }
        expect(d.dish('1:dish 1')!.grams, 0.01);
        var back = d;
        for (var i = 0; i < 5; i++) {
          back = back.stepWhole(1);
        }
        expect(back.dish('1:dish 1')!.grams, closeTo(0.02, 1e-9));
        expect(persistedEditFrom(m, back).edits, isEmpty);
      },
    );
  });

  group('unsaved', () {
    final staged = [item('a', 400, 600), item('b', 100, 200)];

    test('scales off the item as staged and cannot remove a dish', () {
      final draft = draftFromStaged(staged, staged);
      expect(draft.canRemove, isFalse);
      var bottom = draft;
      for (var i = 0; i < 5; i++) {
        bottom = bottom.stepServings('a', -1);
      }
      expect(bottom.servingsMinusDisabled(bottom.dish('a')!), isTrue);
      final out = stagedItemsFrom(draft.stepServings('a', 1), staged, 'en');
      expect(out.first.quantity, 600);
      expect(out.first.macros.calories, 900);
      expect(out.last.quantity, 100);
      expect(out.last.macros.calories, 200);
    });

    test('untouched items come back exactly as they went in', () {
      final odd = [item('a', 5, 36), item('b', 12.5, 20)];
      final out = stagedItemsFrom(
        draftFromStaged(odd, odd).stepAmount('b', 1),
        odd,
        'en',
      );
      expect(out.first, same(odd.first)); // no floor, no rounding
      expect(out.last.quantity, 23); // 12.5 + 10, rounded once
      expect(out.last.macros.calories, closeTo(20 * 23 / 12.5, 1e-9));
    });

    test('stepping back to the staged amount restores it exactly', () {
      final odd = [item('b', 12.5, 20)];
      final up = stagedItemsFrom(
        draftFromStaged(odd, odd).stepAmount('b', 1),
        odd,
        'en',
      );
      expect(up.single.quantity, 23);
      // Reopen on the edited card, step Servings back down to 1×.
      final back = stagedItemsFrom(
        // 1.84× → 1.5× → 1×.
        draftFromStaged(up, odd).stepServings('b', -1).stepServings('b', -1),
        up,
        'en',
      );
      expect(back.single.quantity, 12.5);
      expect(back.single.macros.calories, 20);
      expect(deriveQuantityEdits(back, odd), isEmpty);
    });

    test('an already-edited item reopens at its current grams', () {
      final edited = [item('a', 500, 750), staged.last];
      final draft = draftFromStaged(edited, staged);
      expect(draft.dish('a')!.grams, 500);
      expect(draft.dish('a')!.servings, 1.25);
      expect(draft.totals.kcal, 750 + 200);
    });

    test('a resized bowl re-points its vessel to the tier it now claims', () {
      const medium = ContainerVessel(
        family: ContainerFamily.bowl,
        tier: 2,
        dishClass: DishClass.solid,
      );
      final bowlItem = [item('a', 450, 600, vessel: medium)];
      final out = stagedItemsFrom(
        draftFromStaged(bowlItem, bowlItem).setGrams('a', 2000),
        bowlItem,
        'en',
      );
      expect((out.first.vessel! as ContainerVessel).tier, 4);
    });
  });
}
