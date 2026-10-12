import '../../../../../../models/nutrition/ingredient.dart';

/// The food page open on the add sheet, and the grams it is set to: a food
/// not yet in the meal, or a meal item being edited. One value instead of a
/// food, an optional item id and a separate grams field, so "is it in the
/// meal?" is answered once, by its type.
sealed class ManualOpenFood {
  const ManualOpenFood(this.grams);

  final double grams;
  IngredientSearchResult get food;

  /// The meal item this page edits; null for a new food.
  String? get itemId;

  ManualOpenFood withGrams(double grams);
}

/// A food the meal doesn't hold yet: committing adds it.
final class NewFood extends ManualOpenFood {
  const NewFood(this.food, super.grams);

  @override
  final IngredientSearchResult food;

  @override
  String? get itemId => null;

  @override
  NewFood withGrams(double grams) => NewFood(food, grams);
}

/// A food already in the meal: committing updates its amount, and it can be
/// removed. Opens at the amount it holds.
final class MealFood extends ManualOpenFood {
  MealFood(this.item, [double? grams]) : super(grams ?? item.grams);

  final ManualLogItem item;

  @override
  IngredientSearchResult get food => item.ingredient;

  @override
  String get itemId => item.id;

  @override
  MealFood withGrams(double grams) => MealFood(item, grams);
}
