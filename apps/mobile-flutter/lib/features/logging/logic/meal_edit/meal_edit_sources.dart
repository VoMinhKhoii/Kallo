/// Into and out of a [MealEditDraft], for each life of a meal.
///
/// A saved meal comes in as its ingredient rows grouped into dishes and goes
/// back out as per-row gram overrides plus removals — the payload the update
/// endpoint already takes. An unsaved meal comes in as its staged items and
/// goes back as those items re-scaled, which the card's confirm then sends.
library;

import '../../../../models/logging/meal.dart';
import '../../data/logging_models.dart';
import '../portion/portion_anchors.dart';
import 'meal_edit_draft.dart';

/// Persist a saved meal's edit: gram overrides keyed by `meal_items` id, and
/// the ids of the rows to drop. Resolves on success; throws to keep the sheet
/// open for a retry.
typedef AmountEditSave =
    Future<void> Function({
      required List<Map<String, dynamic>> edits,
      required List<String> removeIds,
    });

/// A saved meal's dishes, in the order the card lists them.
MealEditDraft draftFromPersisted(PersistedMeal meal) {
  final groups = [...meal.mealItemGroups]
    ..sort((a, b) => a.order.compareTo(b.order));
  return MealEditDraft(
    canRemove: true,
    dishes: [for (final g in groups) _persistedDish(g)],
  );
}

EditDish _persistedDish(PersistedMealItemGroup group) {
  final parts = [
    for (final i in group.ingredients)
      EditPart(
        id: i.id,
        grams: i.estimatedGrams,
        kcal: i.nutrition.caloriesKcal,
        protein: i.nutrition.proteinG,
        carbs: i.nutrition.carbohydrateG,
        fat: i.nutrition.fatG,
      ),
  ];
  final weighed = group.ingredients.where((i) => (i.estimatedGrams ?? 0) > 0);
  // A drink logged in millilitres reads in ml; anything mixed reads in grams.
  final unit =
      weighed.isNotEmpty && weighed.every((i) => i.userFacingUnit == 'ml')
          ? 'ml'
          : 'g';
  final logged = parts.fold<double>(
    0,
    (sum, p) => sum + (p.scales ? p.grams! : 0),
  );
  // Exactly as logged — no floor applied on the way in, so an untouched sheet
  // saves nothing and shows what the card shows.
  return EditDish(
    key: '${group.order}',
    name: group.name,
    unit: unit,
    parts: parts,
    grams: logged,
  );
}

/// The update payload for [draft] against the meal it was opened on: every
/// weighed row of a resized dish at its new grams, and every row of a dish
/// that was taken out.
({List<Map<String, dynamic>> edits, List<String> removeIds}) persistedEditFrom(
  PersistedMeal meal,
  MealEditDraft draft,
) {
  final original = draftFromPersisted(meal);
  final edits = <Map<String, dynamic>>[];
  final removeIds = <String>[];
  for (final before in original.dishes) {
    final after = draft.dish(before.key);
    if (after == null) {
      removeIds.addAll([
        for (final p in before.parts)
          if (p.id != null) p.id!,
      ]);
      continue;
    }
    final ratio = after.servings;
    if ((ratio - 1).abs() < 1e-9) continue;
    for (final p in before.parts) {
      final grams = p.grams;
      if (p.id == null || grams == null || !p.scales) continue;
      // Tenths, not whole grams: a 2 g pinch of salt at 1.5× is 3 g, and at
      // 0.25× it must not round away to nothing (the endpoint wants > 0).
      final rounded = (grams * ratio * 10).round() / 10;
      final next = rounded < 0.1 ? 0.1 : rounded;
      if (next == grams) continue;
      edits.add({'id': p.id, 'newGrams': next});
    }
  }
  return (edits: edits, removeIds: removeIds);
}

/// An unsaved meal's dishes. Each scales off the item as STAGED ([original]),
/// so repeated edits never compound rounding — the same base the old steppers
/// used.
MealEditDraft draftFromStaged(List<MealItem> items, List<MealItem> original) {
  final byId = {for (final o in original) o.id: o};
  return MealEditDraft(
    canRemove: false,
    dishes: [
      for (final item in items) _stagedDish(item, byId[item.id] ?? item),
    ],
  );
}

EditDish _stagedDish(MealItem item, MealItem base) => EditDish(
  key: item.id,
  name: item.name,
  unit: item.unit,
  vessel: item.vessel,
  grams: item.quantity,
  parts: [
    EditPart(
      grams: base.quantity,
      kcal: base.macros.calories,
      protein: base.macros.protein,
      carbs: base.macros.carbs,
      fat: base.macros.fat,
    ),
  ],
);

/// [items] re-scaled to the draft. The vessel follows the grams to the tier
/// they may honestly claim, as a pick from the portion picker always did.
List<MealItem> stagedItemsFrom(
  MealEditDraft draft,
  List<MealItem> items,
  String locale,
) => [for (final item in items) _stagedItem(item, draft.dish(item.id), locale)];

MealItem _stagedItem(MealItem item, EditDish? dish, String locale) {
  // Untouched dishes come back exactly as they went in — no rounding, no
  // re-derived macros, so they add nothing to the confirm's overrides.
  if (dish == null || dish.grams == item.quantity) return item;
  // Back on the amount as staged (1×, or a round trip of edits): commit the
  // staged figure itself. Rounding a fractional one — 12.5 g → 13 g — would
  // leave an override behind that the user had just undone.
  final staged = dish.originalGrams;
  final grams =
      (dish.grams - staged).abs() < 1e-6 ? staged : dish.grams.roundToDouble();
  final t = dish.at(grams).totals;
  final vessel = dish.vessel;
  return item.copyWith(
    quantity: grams,
    macros: MacroBreakdown(
      calories: t.kcal ?? 0,
      protein: t.protein ?? 0,
      carbs: t.carbs ?? 0,
      fat: t.fat ?? 0,
    ),
    vessel:
        vessel == null
            ? null
            : repointVessel(
              vessel,
              buildAnchors(vessel, locale),
              grams.round(),
            ),
  );
}
