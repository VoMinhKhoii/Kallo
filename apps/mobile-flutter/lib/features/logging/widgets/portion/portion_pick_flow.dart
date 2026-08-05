import 'package:flutter/material.dart';

import '../../../../models/meal.dart';
import '../../logic/meal_utils.dart';
import 'portion_picker_sheet.dart';

/// Opens the portion picker for [item] and returns [items] re-scaled to the
/// grams the sheet previewed — or null if it was dismissed, or if the dish has
/// no vessel to picture in the first place.
///
/// Scaling routes through [applyQuantityChange], the same helper the +/-
/// steppers use, so a portion pick and a stepper tap produce identical macros
/// for identical grams. The picked vessel then replaces the item's own: the
/// sheet only ever hands back a tier the committed amount may honestly claim,
/// so the card's assumption line can't end up naming a vessel the picker
/// wouldn't.
Future<List<MealItem>?> pickPortion(
  BuildContext context, {
  required MealItem item,
  required List<MealItem> items,
  required List<MealItem> original,
}) async {
  final vessel = item.vessel;
  if (vessel == null) return null;

  final pick = await showPortionPicker(
    context,
    vessel: vessel,
    grams: item.quantity.round(),
    itemCalories: item.macros.calories,
    itemQuantity: item.quantity,
  );
  if (pick == null) return null;

  // Read the quantity back out of the CURRENT list. The sheet was open across
  // an await, so the captured `item` may be a stale copy of a row a stepper has
  // moved since — deltas must be computed against what is on screen now.
  final current = items.firstWhere(
    (it) => it.id == item.id,
    orElse: () => item,
  );
  return applyQuantityChange(
        items,
        original,
        item.id,
        pick.grams - current.quantity,
      )
      .map((it) => it.id == item.id ? it.copyWith(vessel: pick.vessel) : it)
      .toList();
}
