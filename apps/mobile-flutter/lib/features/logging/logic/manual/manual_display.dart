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

/// A food's page open over the plate: a new food, or the item [itemId] edits.
typedef ManualPeekPage =
    ({IngredientSearchResult food, double grams, String? itemId});

/// What the add sheet's peek strip says about the plate under it.
sealed class ManualPeek {
  const ManualPeek();
}

/// Nothing on the plate, and no food's page open.
final class PeekEmpty extends ManualPeek {
  const PeekEmpty();
}

/// What is on the plate: "3 ingredients · 295 kcal" ([kcal] null reads "—").
final class PeekTotal extends ManualPeek {
  const PeekTotal(this.count, this.kcal);
  final int count;
  final double? kcal;
}

/// The plate, then what it becomes with the open food: added ("→ 475 kcal
/// with this"), or at an [edit]ed amount ("→ 420 kcal").
final class PeekChange extends PeekTotal {
  const PeekChange(super.count, super.kcal, this.after, {required this.edit});
  final double after;
  final bool edit;
}

/// The peek strip: what is on the plate and — with a food's [page] open —
/// what the plate becomes with it. Nothing after the arrow for a food with no
/// calorie figure, or for an edit that has not moved the total. Pass no page
/// for a food the plate cannot take. Mirrors the web's `manualPeek`.
ManualPeek manualPeek(List<ManualLogItem> items, ManualPeekPage? page) {
  if (page == null && items.isEmpty) return const PeekEmpty();
  final count = items.length;
  final kcal = totalsForManualItems(items).caloriesKcal;
  final added = page?.food.per100g.scaledTo(page.grams).caloriesKcal;
  if (page == null || added == null) return PeekTotal(count, kcal);
  final kept = [
    for (final item in items)
      if (item.id != page.itemId) item,
  ];
  final after = (totalsForManualItems(kept).caloriesKcal ?? 0) + added;
  final unmoved =
      page.itemId != null && kcal != null && after.round() == kcal.round();
  if (unmoved) return PeekTotal(count, kcal);
  return PeekChange(count, kcal, after, edit: page.itemId != null);
}
