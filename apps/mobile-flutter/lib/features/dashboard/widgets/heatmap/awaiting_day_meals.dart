import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/logic/display_format.dart';
import '../../../../shared/logic/macro_composition.dart';
import '../../../../shared/widgets/nutrition/meal_block.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../../logging/logic/format.dart';
import '../../data/logging_day.dart';

/// The meals area of the awaiting-day sheet: a spinner while the day loads,
/// a quiet line if it fails, then [AwaitingDayMeals].
class AwaitingDayMealsBody extends StatelessWidget {
  const AwaitingDayMealsBody({super.key, required this.day});
  final AsyncValue<LoggingDayData> day;

  @override
  Widget build(BuildContext context) {
    return day.when(
      skipLoadingOnReload: true,
      loading:
          () => const Padding(
            padding: EdgeInsets.all(KalloSpacing.sp6),
            child: Center(child: CircularProgressIndicator.adaptive()),
          ),
      error:
          (_, __) => Padding(
            padding: const EdgeInsets.symmetric(vertical: KalloSpacing.sp4),
            child: Text(
              tr('dashboard.adherenceHeatmap.dayDialog.loadError'),
              style: dashMeta(color: kInkMuted),
            ),
          ),
      data: (d) => AwaitingDayMeals(meals: d.persistedMeals),
    );
  }
}

/// An awaiting day's meals, oldest first — the order the day was eaten in,
/// which is how a user checks it for a missing meal.
///
/// Each meal reads as the logging card draws it (the shared [MealBlock], kcal
/// closing the legend) under a rule carrying its time. Twin of web
/// `awaiting-day-meals.tsx`.
class AwaitingDayMeals extends StatelessWidget {
  const AwaitingDayMeals({super.key, required this.meals});

  /// Newest first, as the server sends them.
  final List<PersistedMeal> meals;

  @override
  Widget build(BuildContext context) {
    final locale = localeOf(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final meal in meals.reversed) ...[
          const SizedBox(height: KalloSpacing.sp3),
          _TimeDivider(
            time: DateFormat.jm(
              locale,
            ).format(DateTime.parse(meal.loggedAt).toLocal()),
          ),
          const SizedBox(height: KalloSpacing.sp3),
          _mealBlock(meal.rawInput, meal.nutrition, locale),
        ],
        const SizedBox(height: KalloSpacing.sp4),
      ],
    );
  }
}

/// The day's total, pinned above the confirm, on one line the way the logging
/// card's Total row reads: "Total", then P · C · F, then the kcal. Twin of web
/// `awaiting-day-total.tsx`. Draws nothing until there are meals to sum.
class AwaitingDayTotal extends StatelessWidget {
  const AwaitingDayTotal({super.key, required this.meals});
  final List<PersistedMeal> meals;

  /// Summed over the meals that measured it; null when none did.
  static double? _sum(Iterable<double?> values) {
    final known = values.whereType<double>();
    return known.isEmpty ? null : known.fold<double>(0, (a, b) => a + b);
  }

  @override
  Widget build(BuildContext context) {
    if (meals.isEmpty) return const SizedBox.shrink();
    final nutrition = meals.map((m) => m.nutrition);
    final total = MealNutrition(
      caloriesKcal: nutrition.fold<double>(
        0,
        (a, n) => a + (n.caloriesKcal ?? 0),
      ),
      proteinG: _sum(nutrition.map((n) => n.proteinG)),
      carbohydrateG: _sum(nutrition.map((n) => n.carbohydrateG)),
      fatG: _sum(nutrition.map((n) => n.fatG)),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Divider(height: 1, thickness: 1, color: kHairline),
        const SizedBox(height: KalloSpacing.sp3),
        // One line, no glyphs: the logging card's Total row.
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Text(
              tr('dashboard.adherenceHeatmap.dayDialog.total'),
              style: dashBody(),
            ),
            const Spacer(),
            for (final label in _gramLabels(total).values) ...[
              Text(label, style: dashCaption(color: kInk)),
              const SizedBox(width: KalloSpacing.sp3),
            ],
            Text(
              fmtKcal(total.caloriesKcal, locale: localeOf(context)),
              style: dashBody(),
            ),
          ],
        ),
      ],
    );
  }
}

/// One meal as the logging card draws it.
Widget _mealBlock(String title, MealNutrition n, String locale) {
  return MealBlock(
    title: title,
    segments:
        compositionFromGrams((
          protein: n.proteinG,
          carbohydrate: n.carbohydrateG,
          fat: n.fatG,
        )).segments,
    gramLabels: _gramLabels(n),
    kcalLabel: fmtKcal(n.caloriesKcal, locale: locale),
    kcalPlacement: MealBlockKcal.legendTrailing,
  );
}

/// The rule between meals, with the next meal's time in its middle.
class _TimeDivider extends StatelessWidget {
  const _TimeDivider({required this.time});
  final String time;

  @override
  Widget build(BuildContext context) {
    final rule = Expanded(
      child: Divider(height: 1, thickness: 1, color: kHairline),
    );
    return Row(
      children: [
        rule,
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: KalloSpacing.sp3),
          child: Text(time, style: dashMeta(color: kInkMuted, tabular: true)),
        ),
        rule,
      ],
    );
  }
}

/// "P 28g" per measured macro; an unmeasured one is left out, as on the
/// logging card.
Map<String, String> _gramLabels(MealNutrition n) => {
  if (n.proteinG != null) 'protein': 'P ${fmtG(n.proteinG)}',
  if (n.carbohydrateG != null) 'carbohydrate': 'C ${fmtG(n.carbohydrateG)}',
  if (n.fatG != null) 'fat': 'F ${fmtG(n.fatG)}',
};
