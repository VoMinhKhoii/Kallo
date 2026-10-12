import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/logging/logic/manual/manual_amount.dart';
import 'package:kallo_mobile/features/logging/logic/manual/manual_display.dart';
import 'package:kallo_mobile/features/logging/logic/portion/portion_anchors.dart';
import 'package:kallo_mobile/models/nutrition/ingredient.dart';
import 'package:kallo_mobile/models/nutrition/vessel.dart';

IngredientSearchResult food({
  String name = 'Ức gà',
  String? nameEn = 'Chicken, breast, raw',
  String? displayNameEn = 'Skinless chicken breast',
  String? stateLabel = 'raw',
  String? brand,
  ClientVessel? vessel,
}) => IngredientSearchResult(
  id: name,
  namePrimary: name,
  nameEn: nameEn,
  state: 'raw',
  per100g: const IngredientMacrosPer100g(caloriesKcal: 120),
  displayNameEn: displayNameEn,
  stateLabel: stateLabel,
  brand: brand,
  vessel: vessel,
);

String word(String state) => state == 'cooked' ? 'Cooked' : 'Raw';

void main() {
  group('subtitles', () {
    test('lead with the state the card claims, then the English name', () {
      expect(searchSubtitle(food(), word), (
        lead: 'Raw',
        rest: 'Skinless chicken breast',
      ));
      expect(searchSubtitle(food(stateLabel: 'cooked'), word).lead, 'Cooked');
    });

    test(
      'show no state when the card names none — never the table default',
      () {
        expect(searchSubtitle(food(stateLabel: null), word), (
          lead: null,
          rest: 'Skinless chicken breast',
        ));
      },
    );

    test('a brand takes the state slot', () {
      final milk = food(name: 'Sữa', stateLabel: null, brand: 'Vinamilk');
      expect(searchSubtitle(milk, word).lead, 'Vinamilk');
    });

    test('fall back to the table English name, then to nothing', () {
      expect(
        searchSubtitle(food(displayNameEn: null), word).rest,
        'Chicken, breast, raw',
      );
      expect(
        searchSubtitle(food(displayNameEn: null, nameEn: null), word).rest,
        isNull,
      );
    });

    test('a meal row swaps the English name for its grams', () {
      expect(mealSubtitle(food(), word, '150 g'), (lead: 'Raw', rest: '150 g'));
    });
  });

  group('figures', () {
    test('grams and macros drop a trailing .0 and keep one decimal', () {
      expect(formatGrams(150), '150');
      expect(formatGrams(37.5), '37.5');
      expect(formatGrams(12.34), '12.3');
      expect(formatMacroGrams(null), '—');
      expect(formatKcal(179.6), '180');
      expect(formatKcal(null), '—');
    });

    test('the default title joins the ingredient names with " + "', () {
      ManualLogItem item(String name) =>
          ManualLogItem(id: name, ingredient: food(name: name), grams: 100);
      expect(
        defaultMealTitle([item('Ức gà'), item('Cơm trắng')]),
        'Ức gà + Cơm trắng',
      );
      expect(defaultMealTitle(const []), '');
    });
  });

  group('the peek strip', () {
    final chicken = food();
    const mystery = IngredientSearchResult(
      id: 'm',
      namePrimary: 'Lá mơ lông',
      nameEn: null,
      state: 'raw',
      per100g: IngredientMacrosPer100g(proteinG: 4.1),
    );
    final items = [ManualLogItem(id: 'a', ingredient: chicken, grams: 150)];
    ManualPeekPage page(IngredientSearchResult f, double g, [String? id]) => (
      food: f,
      grams: g,
      itemId: id,
    );

    test('the plate alone', () {
      expect(manualPeek(const [], null), isA<PeekEmpty>());
      final total = manualPeek(items, null) as PeekTotal;
      expect((total.count, total.kcal), (1, 180));
      expect(total, isNot(isA<PeekChange>()));
      // Unknown calories stay unknown, never 0.
      const unknown = [
        ManualLogItem(id: 'm1', ingredient: mystery, grams: 100),
      ];
      expect((manualPeek(unknown, null) as PeekTotal).kcal, isNull);
    });

    test('with a new food: what the plate becomes', () {
      final added = manualPeek(items, page(chicken, 100)) as PeekChange;
      expect((added.kcal, added.after, added.edit), (180, 300, false));
      // On an empty plate a food's page still counts the plate.
      final first = manualPeek(const [], page(chicken, 50)) as PeekChange;
      expect((first.count, first.kcal, first.after), (0, 0, 60));
    });

    test(
      'an edit replaces its own amount, and says nothing until it moves',
      () {
        final edit = manualPeek(items, page(chicken, 100, 'a')) as PeekChange;
        expect((edit.after, edit.edit), (120, true));
        expect(
          manualPeek(items, page(chicken, 150, 'a')),
          isNot(isA<PeekChange>()),
        );
      },
    );

    test('a food with no calorie figure promises nothing', () {
      expect(manualPeek(items, page(mystery, 100)), isNot(isA<PeekChange>()));
    });
  });

  group('amount', () {
    test('opens at the vessel\'s everyday tier, else 100 g', () {
      const medium = PieceVessel(tier: 3, count: 1, kind: PieceKind.poultry);
      expect(initialManualGrams(food(vessel: medium)), 150);
      expect(initialManualGrams(food()), 100);
      const cup = ContainerVessel(
        family: ContainerFamily.cup,
        tier: 2,
        dishClass: DishClass.drink,
      );
      // A regular 250 ml cup, poured to its fill, as the meal card resolves it.
      expect(initialManualGrams(food(vessel: cup)), 231);
    });

    test('− / + land on the next multiple of 10 and stop at the range', () {
      expect(steppedManualGrams(147, 1), 150);
      expect(steppedManualGrams(147, -1), 140);
      expect(steppedManualGrams(150, 1), 160);
      expect(steppedManualGrams(150, -1), 140);
      expect(steppedManualGrams(10, -1), isNull);
      expect(steppedManualGrams(5, 1), 10);
      expect(steppedManualGrams(5000, 1), isNull);
    });

    test('the ruler spans 10 g to half again past the largest vessel', () {
      const medium = PieceVessel(tier: 3, count: 1, kind: PieceKind.meat);
      final anchors = buildAnchors(medium, 'en');
      expect(manualRulerRange(anchors), (min: 10, max: 750));
    });
  });
}
