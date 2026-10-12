/// What the manual-log sheets print for a food: the subtitle under its name,
/// the gram and macro figures, and the meal's default title.
///
/// Pure, so the wording rules — which part is ink, when a state is shown at
/// all — are tested without pumping a sheet.
library;

import '../../../../models/nutrition/ingredient.dart';

/// The subtitle under a food's name: a [lead] in ink (its state, or a
/// packaged food's brand) and the [rest] in muted after " · ".
typedef ManualSubtitleText = ({String? lead, String? rest});

/// The state word for [result], already translated by [stateWord], or its
/// brand — never the table's default state, which says "raw" for canned fish.
String? manualLead(
  IngredientSearchResult result,
  String Function(String state) stateWord,
) {
  final state = result.stateLabel;
  if (state != null) return stateWord(state);
  return result.brand;
}

/// "Raw · Skinless chicken breast" for a search row.
ManualSubtitleText searchSubtitle(
  IngredientSearchResult result,
  String Function(String state) stateWord,
) => (lead: manualLead(result, stateWord), rest: result.englishName);

/// "Raw · 150 g" for a row already in the meal ([suffix] carries the grams,
/// "150 g" or "150 g in meal").
ManualSubtitleText mealSubtitle(
  IngredientSearchResult result,
  String Function(String state) stateWord,
  String suffix,
) => (lead: manualLead(result, stateWord), rest: suffix);

/// Grams as typed: "150", "37.5" — never "150.0".
String formatGrams(double grams) {
  final rounded = (grams * 10).round() / 10;
  return rounded == rounded.roundToDouble()
      ? rounded.round().toString()
      : rounded.toString();
}

/// A macro figure: one decimal, trailing ".0" dropped — "38.4", "45".
String formatMacroGrams(double? grams) =>
    grams == null ? '—' : formatGrams(grams);

/// Whole kcal, or "—" when unknown (never 0).
String formatKcal(double? kcal) => kcal == null ? '—' : '${kcal.round()}';

/// The name a meal saves under when the user gives none — the same rule the
/// server applies, so the placeholder shows exactly what will be logged.
String defaultMealTitle(List<ManualLogItem> items) =>
    items.map((item) => item.ingredient.namePrimary).join(' + ');

/// The meal's calories with [food] at [grams] in it — added, or replacing the
/// amount of the item [replacing] when that food is already in the meal.
double mealKcalWith(
  List<ManualLogItem> items,
  IngredientSearchResult food,
  double grams, {
  String? replacing,
}) {
  final total = totalsForManualItems(items).caloriesKcal ?? 0;
  final before =
      items
          .where((item) => item.id == replacing)
          .firstOrNull
          ?.macros
          ?.caloriesKcal ??
      0;
  return total - before + (food.per100g.scaledTo(grams).caloriesKcal ?? 0);
}
