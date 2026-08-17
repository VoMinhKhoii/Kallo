/// The dashboard dock's meal list: today's logged meals, or the empty state.
///
/// Split out of `today_section.dart` for the same reason as the macro rows —
/// that file is frozen at its current size by the ratchet.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/logging_day.dart';
import '../../../../shared/logic/display_format.dart';
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
        // Header row.
        Padding(
          padding: const EdgeInsets.only(bottom: DashboardSpacing.row * 2),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                tr('dashboard.recentMeals').toUpperCase(),
                style: dashMeta(),
              ),
              Text(
                tr(
                  'dashboard.mealsLogged',
                  namedArgs: {'count': '${meals.length}'},
                ),
                style: dashMeta(color: kInkMuted),
              ),
            ],
          ),
        ),
        // No separator: each row carries DashboardSpacing.row top and bottom,
        // so neighbours sit `row * 2` apart without a second gap owner.
        for (final meal in meals) _MealRow(meal: meal),
      ],
    );
  }
}

class _MealRow extends StatelessWidget {
  const _MealRow({required this.meal});
  final PersistedMeal meal;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: DashboardSpacing.row),
      // Baseline-align the name and kcal so the row reads on one line; the meal
      // name sits at content-left (aligned with the macro labels above) and
      // kcal in the shared right column (aligned with the macro values).
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          Expanded(
            child: Text(
              meal.rawInput,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: dashBody(),
            ),
          ),
          const SizedBox(width: KalloSpacing.sp2),
          SizedBox(
            width: dashboardValueColumnWidth,
            // Shares the macro rows' right edge, so it needs the same guard:
            // wrapping here would grow the meal row out of line with the bars
            // above it.
            child: FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerRight,
              child: Text(
                '${round0(meal.nutrition.caloriesKcal)} kcal',
                maxLines: 1,
                softWrap: false,
                textAlign: TextAlign.right,
                style: dashMeta(color: kInkMuted, tabular: true),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
