import 'package:flutter/material.dart';

import '../../../../models/logging/meal.dart';
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

  // The delta is measured against `items`, which is the same snapshot `item`
  // came from — the sheet is modal, so nothing can move the row underneath it
  // while it is open. Deriving it from the list rather than from `item` keeps
  // that true if the sheet ever stops being modal.
  final current = items.firstWhere((it) => it.id == item.id, orElse: () => item);
  return applyQuantityChange(
        items,
        original,
        item.id,
        // Exactly the previewed grams, so the committed amount is the number
        // the readout showed when Apply was pressed — not that number nudged
        // by whatever fraction the estimator's original quantity carried.
        pick.grams - current.quantity,
      )
      .map((it) => it.id == item.id ? it.copyWith(vessel: pick.vessel) : it)
      .toList();
}
