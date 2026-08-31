/// The dashboard dock's meal list: today's logged meals, or the empty state.
///
/// Rows are the shared [MealBlock] — the same anatomy the logging feed card and
/// Circle posts draw, so a meal reads identically wherever it appears. Own
/// meals put the kcal figure on the title line's right; Circle leads its legend
/// with it instead.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/logic/display_format.dart';
import '../../../../shared/logic/macro_composition.dart';
import '../../../../shared/widgets/nutrition/meal_block.dart';
import '../../../../theme/calm_tokens.dart';
import '../../data/logging_day.dart';
import '../../logic/dashboard_spacing.dart';

/// Empty state — plain centered text on the card surface (no dashed border).
class EmptyMeals extends StatelessWidget {
  const EmptyMeals({super.key});

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 96),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            tr('dashboard.noMealsToday'),
            textAlign: TextAlign.center,
            style: dashBody(weight: FontWeight.w600),
          ),
          const SizedBox(height: DashboardSpacing.row),
          Text(
            tr('dashboard.mealReceiptsHint'),
            textAlign: TextAlign.center,
            style: dashMeta(color: kInkMuted),
          ),
        ],
      ),
    );
  }
}

class MealList extends StatelessWidget {
  const MealList({super.key, required this.meals});
  final List<PersistedMeal> meals;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < meals.length; i++) ...[
          // A hairline between rows. The card insets its own sides, so the rule
          // is already inset to the text column it separates.
          if (i > 0) const Divider(height: 1, thickness: 1, color: kHairline),
          _MealRow(meal: meals[i]),
        ],
      ],
    );
  }
}

class _MealRow extends StatelessWidget {
  const _MealRow({required this.meal});
  final PersistedMeal meal;

  /// "P 28g" — an em dash for a macro that was never measured, rather than a
  /// confident zero.
  static String _gramLabel(String prefix, double? grams) =>
      '$prefix ${grams == null ? '—' : '${grams.round()}g'}';

  @override
  Widget build(BuildContext context) {
    // Spelled once: the bar and the figures under it read the same record.
    final macros = (
      protein: meal.nutrition.proteinG,
      carbohydrate: meal.nutrition.carbohydrateG,
      fat: meal.nutrition.fatG,
    );
    final composition = compositionFromGrams(macros);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: DashboardSpacing.section),
      child: MealBlock(
        title: meal.rawInput,
        segments: composition.segments,
        gramLabels: {
          'protein': _gramLabel('P', macros.protein),
          'carbohydrate': _gramLabel('C', macros.carbohydrate),
          'fat': _gramLabel('F', macros.fat),
        },
        // "kcal" is the unit symbol in every locale the app ships, so it is
        // spelled inline here as it is in the Circle feed.
        kcalLabel: '${round0(meal.nutrition.caloriesKcal)} kcal',
      ),
    );
  }
}
