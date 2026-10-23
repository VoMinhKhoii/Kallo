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

/// Servings move in halves: "1×", "1.5×", "2×".
const double servingStep = 0.5;

/// Amount moves in tens, the same step the old steppers used.
const double amountStep = 10;

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

  /// Stable identity: the group order on a saved meal, the item id otherwise.
  final String key;
  final String name;

  /// 'g' or 'ml'.
  final String unit;
  final List<EditPart> parts;

  /// The dish's grams now — what the sheet shows and what is saved.
  final double grams;

  /// The amount the Whole meal multiplier asked for, before the [floor]. It is
  /// kept apart from [grams] so taking the whole meal down and back up returns
  /// a dish that hit the floor to exactly where it started.
  final double target;

  /// The vessel the pipeline pictured it in — unsaved dishes only.
  final ClientVessel? vessel;

  /// The grams as logged: the sum of the parts that have one.
  double get originalGrams => parts.fold(0, (sum, p) => sum + (p.grams ?? 0));

  /// False for a dish whose parts carry no grams at all — nothing to step.
  bool get scalable => originalGrams > 0;

  /// How much of the logged amount this is: 1 as logged, 2 for double.
  double get servings => scalable ? grams / originalGrams : 1;

  /// The least this dish can be stepped down to: [minDishGrams], or what it
  /// was logged at when that is less. A 5 g pat of butter stays 5 g until the
  /// user moves it — opening the sheet never rewrites a saved amount.
  double get floor =>
      originalGrams < minDishGrams ? originalGrams : minDishGrams;

  /// True when no step down is left: the next minus would remove the dish.
  bool get atBottom =>
      !scalable || servings <= servingStep + _eps || grams <= floor + _eps;

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

  /// A user's own adjustment, held at the [floor].
  EditDish withGrams(double next) {
    final g = next < floor ? floor : next;
    return _copy(grams: g, target: g);
  }

  /// The Whole meal multiplier: scales the [target], then floors the grams.
  EditDish scaledBy(double factor) {
    final t = target * factor;
    return _copy(grams: t < floor ? floor : t, target: t);
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
      final scale = part.grams == null ? 1.0 : ratio;
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

  /// Up or down to the next whole half serving: 1.2× goes to 1.5× or 1×.
  MealEditDraft stepServings(String key, int direction) {
    final d = dish(key);
    if (d == null) return this;
    if (direction < 0 && removesOnMinus(d)) return remove(key);
    if (!d.scalable || (direction < 0 && servingsMinusDisabled(d))) {
      return this;
    }
    final steps = d.servings / servingStep;
    final next =
        direction > 0
            ? ((steps + _eps).floorToDouble() + 1) * servingStep
            : ((steps - _eps).ceilToDouble() - 1) * servingStep;
    return _map(key, (d) => d.withGrams(d.originalGrams * next));
  }

  /// Ten grams either way, from the rounded figure the row shows.
  MealEditDraft stepAmount(String key, int direction) => _map(
    key,
    (d) => d.withGrams(d.grams.roundToDouble() + direction * amountStep),
  );

  /// Exact grams, from the Size ruler.
  MealEditDraft setGrams(String key, double grams) =>
      _map(key, (d) => d.withGrams(grams));

  /// Every dish by the same factor, half a meal at a time.
  MealEditDraft stepWhole(int direction) {
    final next = whole + direction * servingStep;
    if (next < servingStep) return this;
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
