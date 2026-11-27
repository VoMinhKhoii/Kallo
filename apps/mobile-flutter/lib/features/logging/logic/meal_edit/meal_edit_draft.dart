/// The meal edit sheet's state: every dish's current grams, the whole-meal
/// multiplier, and the arithmetic the Servings / Amount / Size controls run.
///
/// One model for both lives of a meal. A saved meal's dish is the ingredient
/// rows it was logged as; an unsaved one's is the single staged item. Either
/// way a dish scales as ONE thing — every gram-bearing part by the same ratio —
/// so the sheet never edits an ingredient on its own.
library;

import 'package:flutter/foundation.dart';

import '../../../../models/nutrition/vessel.dart';
import '../meal_utils.dart';
import '../serving_ladder.dart';

/// Step size from 1× upward ("1×", "1.5×", "2×"); sub-1× follows the serving
/// ladder (`0.25`, `1/3`, `0.5`, `2/3`, `0.75`).
const double servingStep = servingStepAboveOne;

/// Amount moves in tens, the same step the old steppers used.
const double amountStep = 10;

/// Lowest positive weight/count a scaled dish can drop to (never 0, which the
/// update endpoint rejects).
const double minEditGrams = 0.01;

/// What one part of a dish contributes, at the grams it was logged at.
///
/// A null [grams] is a legacy row with no recorded amount: it cannot scale, so
/// it keeps its nutrition as is. A null macro stays null — never read as 0.
@immutable
class EditPart {
  const EditPart({
    this.id,
    required this.grams,
    required this.kcal,
    required this.protein,
    required this.carbs,
    required this.fat,
  });

  /// The `meal_items` row id on a saved meal; null on an unsaved one.
  final String? id;
  final double? grams;
  final double? kcal;
  final double? protein;
  final double? carbs;
  final double? fat;

  /// Whether this part moves with its dish: only a row with a positive weight.
  /// A null or zero-gram legacy row keeps its nutrition as is — the update
  /// endpoint leaves non-positive rows untouched, so scaling one here would
  /// preview a number the save never writes.
  bool get scales => (grams ?? 0) > 0;
}

/// The four figures the sheet shows, each null when no part carries it.
@immutable
class EditTotals {
  const EditTotals(this.kcal, this.protein, this.carbs, this.fat);

  final double? kcal;
  final double? protein;
  final double? carbs;
  final double? fat;
}

@immutable
class EditDish {
  const EditDish({
    required this.key,
    required this.name,
    required this.unit,
    required this.parts,
    required this.grams,
    double? target,
    this.vessel,
  }) : target = target ?? grams;

  /// Stable identity: `order:name` on a saved meal, the item id otherwise.
  final String key;
  final String name;

  /// 'g', 'ml', or 'serving'.
  final String unit;
  final List<EditPart> parts;

  /// The dish's grams (or serving count when [unit] is `'serving'`) now — what
  /// the sheet shows and what is saved.
  final double grams;

  /// The amount the Whole meal multiplier asked for, before clamping to
  /// [minEditGrams]. Kept apart from [grams] so taking the whole meal down and
  /// back up returns a dish that hit the floor to where it started.
  final double target;

  /// The vessel the pipeline pictured it in — unsaved dishes only.
  final ClientVessel? vessel;

  /// The grams as logged: the sum of the parts that have one.
  double get originalGrams =>
      parts.fold(0, (sum, p) => sum + (p.scales ? p.grams! : 0));

  /// False for a dish whose parts carry no grams at all — nothing to step.
  bool get scalable => originalGrams > 0;

  /// How much of the logged amount this is: 1 as logged, 2 for double.
  double get servings => scalable ? grams / originalGrams : 1;

  /// The least the ±10 g/ml Amount stepper (and Size ruler) can step this dish
  /// down to: [minDishGrams], or what it was logged at when that is less. A 5 g
  /// pat of butter stays 5 g on Amount minus — Servings and Whole meal can
  /// still scale it down along the fractional ladder.
  double get floor =>
      originalGrams < minDishGrams ? originalGrams : minDishGrams;

  /// True when no step down is left: the next minus would remove the dish.
  bool get atBottom =>
      !scalable ||
      servings <= minServingMultiplier + _eps ||
      grams <= minEditGrams + _eps;

  EditTotals get totals => sumTotals([this]);

  EditDish _copy({required double grams, required double target}) => EditDish(
    key: key,
    name: name,
    unit: unit,
    parts: parts,
    grams: grams,
    target: target,
    vessel: vessel,
  );

  /// A user's own adjustment, kept strictly positive.
  EditDish withGrams(double next) {
    final g = next < minEditGrams ? minEditGrams : next;
    return _copy(grams: g, target: g);
  }

  /// The Whole meal multiplier: scales the [target], clamped only at
  /// [minEditGrams] so small or per-serving dishes still scale down.
  EditDish scaledBy(double factor) {
    final t = target * factor;
    return _copy(grams: t < minEditGrams ? minEditGrams : t, target: t);
  }

  /// This dish at exactly [g] — for computing what a committed amount is
  /// worth, never for an edit.
  EditDish at(double g) => _copy(grams: g, target: g);
}

/// Float slack only. A wider tolerance skipped real half-serving steps: 460 g
/// of a 450 g dish stepped down to 225 g instead of back to 450 g.
const double _eps = 1e-6;

/// Each dish's parts scaled by its own ratio, summed per macro.
EditTotals sumTotals(Iterable<EditDish> dishes) {
  final sums = <double>[0, 0, 0, 0];
  final seen = <bool>[false, false, false, false];
  for (final dish in dishes) {
    final ratio = dish.servings;
    for (final part in dish.parts) {
      final scale = part.scales ? ratio : 1.0;
      final values = [part.kcal, part.protein, part.carbs, part.fat];
      for (var i = 0; i < 4; i++) {
        final v = values[i];
        if (v == null) continue;
        sums[i] += v * scale;
        seen[i] = true;
      }
    }
  }
  double? at(int i) => seen[i] ? sums[i] : null;
  return EditTotals(at(0), at(1), at(2), at(3));
}

@immutable
class MealEditDraft {
  const MealEditDraft({
    required this.dishes,
    required this.canRemove,
    this.whole = 1,
  });

  final List<EditDish> dishes;

  /// The Whole meal multiplier, in [servingStep]s from 1.
  final double whole;

  /// Whether a dish may be taken out. Only a saved meal can drop a dish: the
  /// unsaved confirm scales dishes but has no way to leave one out.
  final bool canRemove;

  EditTotals get totals => sumTotals(dishes);

  EditDish? dish(String key) {
    for (final d in dishes) {
      if (d.key == key) return d;
    }
    return null;
  }

  /// True when Servings' minus would take this dish out rather than shrink it:
  /// at half a serving, at its floor, or for a dish with no grams to step.
  bool removesOnMinus(EditDish dish) =>
      dish.atBottom && canRemove && dishes.length > 1;

  /// True when Servings' minus can do nothing at all.
  bool servingsMinusDisabled(EditDish dish) =>
      dish.atBottom && !removesOnMinus(dish);

  MealEditDraft _with(List<EditDish> next, {double? whole}) => MealEditDraft(
    dishes: next,
    canRemove: canRemove,
    whole: whole ?? this.whole,
  );

  MealEditDraft _map(String key, EditDish Function(EditDish) fn) =>
      _with([for (final d in dishes) d.key == key ? fn(d) : d]);

  /// Up or down to the next rung on the serving ladder (`0.25, 1/3, 0.5, 2/3,
  /// 0.75, 1, 1.5, 2, ...`).
  MealEditDraft stepServings(String key, int direction) {
    final d = dish(key);
    if (d == null) return this;
    if (direction < 0 && removesOnMinus(d)) return remove(key);
    if (!d.scalable || (direction < 0 && servingsMinusDisabled(d))) {
      return this;
    }
    final next = stepServingMultiplier(d.servings, direction);
    return _map(key, (d) => d.withGrams(d.originalGrams * next));
  }

  /// Ten grams either way, from the rounded figure the row shows, held at
  /// [EditDish.floor].
  MealEditDraft stepAmount(String key, int direction) => _map(key, (d) {
    final next = d.grams.roundToDouble() + direction * amountStep;
    return d.withGrams(next < d.floor ? d.floor : next);
  });

  /// Exact grams, from the Size ruler, held at [EditDish.floor].
  MealEditDraft setGrams(String key, double grams) =>
      _map(key, (d) => d.withGrams(grams < d.floor ? d.floor : grams));

  /// Every dish by the same factor, stepping along the serving ladder.
  MealEditDraft stepWhole(int direction) {
    final next = stepServingMultiplier(whole, direction);
    if ((next - whole).abs() < _eps) return this;
    final factor = next / whole;
    return _with([
      for (final d in dishes) d.scalable ? d.scaledBy(factor) : d,
    ], whole: next);
  }

  MealEditDraft remove(String key) {
    if (!canRemove || dishes.length <= 1) return this;
    return _with([
      for (final d in dishes)
        if (d.key != key) d,
    ]);
  }
}
