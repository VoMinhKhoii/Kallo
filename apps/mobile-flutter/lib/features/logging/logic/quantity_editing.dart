/// The unconfirmed card's quantity-edit state machine: the draft the steppers
/// and the portion picker write into, and the brief block they put on Confirm.
library;

import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../../models/logging/meal.dart';
import 'meal_utils.dart';

/// The editable quantities on an unconfirmed card: what the server staged,
/// what the user has made of it, and whether that difference will actually be
/// submitted.
///
/// [dirty] is the SAME predicate the confirm sends, not a proxy for it. The
/// proxy was `identical(items, original)`, and [applyQuantityChange] ends in
/// `.toList()` — a NEW list on every tap, no-op or not (a minus at the
/// [minDishGrams] floor, a plus then a minus). So the card's total flipped to
/// the round-then-sum figure (490 against the server's 489) while
/// [deriveQuantityEdits] reported nothing to send at all: the user watched the
/// number change, confirmed, and the saved card came back at the original.
class QuantityDraft {
  QuantityDraft(this.original) : items = original;

  /// The analysis as staged. Every scale is computed off THIS, so repeated
  /// taps don't compound rounding.
  final List<MealItem> original;

  /// The quantities as they now stand.
  List<MealItem> items;

  /// One dish stepped by [delta], scaled off [original] so repeated taps
  /// don't compound rounding.
  List<MealItem> changed(String itemId, double delta) =>
      applyQuantityChange(items, original, itemId, delta);

  /// The minimal set of overrides the confirm will carry.
  List<MealQuantityEdit> get edits => deriveQuantityEdits(items, original);

  /// True only when confirming would really change something.
  bool get dirty => edits.isNotEmpty;

  /// Whether two analyses hold the same dishes at the same amounts.
  ///
  /// What a card re-seeds on. A RE-STAGE lands on the very same card —
  /// `StagedMealCard` is keyed by the analysis id and `analysis_run`
  /// deliberately reuses the attemptId for a retry or a cheat-clarify — so the
  /// dishes are the only thing that says "this is a different meal now". Object
  /// identity would not: a plain day refetch hands over an equal-but-new
  /// [ParsedMeal] each time, and re-seeding on that would throw away an edit in
  /// progress every time the day reloaded.
  static bool sameDishes(ParsedMeal a, ParsedMeal b) {
    if (a.items.length != b.items.length) return false;
    for (var i = 0; i < a.items.length; i++) {
      final (x, y) = (a.items[i], b.items[i]);
      if (x.id != y.id ||
          x.quantity != y.quantity ||
          x.macros.calories != y.macros.calories) {
        return false;
      }
    }
    return true;
  }
}

/// Blocks Confirm for a moment after a quantity tap, so a fast double-tap on a
/// stepper can't slip through and save before the user is done adjusting.
class ConfirmCooldown {
  ConfirmCooldown(this.onSettled);

  static const Duration _window = Duration(milliseconds: 300);

  /// Called when the window closes — the card has to repaint its CTA.
  final VoidCallback onSettled;

  Timer? _timer;
  bool active = false;

  /// (Re-)start the window. Each edit pushes it out again.
  void arm() {
    active = true;
    _timer?.cancel();
    _timer = Timer(_window, () {
      active = false;
      onSettled();
    });
  }

  void dispose() => _timer?.cancel();
}
