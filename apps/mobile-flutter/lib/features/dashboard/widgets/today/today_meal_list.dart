/// The dashboard dock's meal list: today's logged meals, or the empty state.
///
/// Rows follow the Circle feed's vocabulary, because a meal should read the
/// same whether you are looking at your own dock or at a friend's post: the
/// name with its time, the calorie figure with its unit left quiet, the
/// composition bar, then the macro figures under it.
///
/// Dropped from the feed's version: the avatar, the author, the action row and
/// the replies. Those are social affordances with nothing to say on your own
/// dashboard, and the meal name takes the bold-ink identity slot the author's
/// name held there.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/logic/display_format.dart';
import '../../../../shared/logic/macro_composition.dart';
import '../../../../shared/widgets/nutrition/composition_bar.dart';
import '../../../../shared/widgets/nutrition/macro_scale.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
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
          // A hairline between posts, as the feed does. The feed insets its
          // rule to the avatar rail; with no avatars here it runs the full
          // width of the card.
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

  @override
  Widget build(BuildContext context) {
    // Spelled once: the bar and the figures under it read the same record.
    final macros = (
      protein: meal.nutrition.proteinG,
      carbohydrate: meal.nutrition.carbohydrateG,
      fat: meal.nutrition.fatG,
    );
    final composition = compositionFromGrams(macros);
    final loggedAt = DateTime.tryParse(meal.loggedAt);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: DashboardSpacing.section),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Expanded(
                child: Text(
                  meal.rawInput,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: dashValue(),
                ),
              ),
              if (loggedAt != null) ...[
                const SizedBox(width: KalloSpacing.sp3),
                Text(
                  formatLoggedTime(
                    loggedAt,
                    locale: context.locale.languageCode,
                  ),
                  style: dashMeta(),
                ),
              ],
            ],
          ),
          const SizedBox(height: DashboardSpacing.label),
          Text.rich(
            TextSpan(
              // Unit stays at Meta so the figure carries the mass, not the word.
              style: dashMeta(),
              children: [
                TextSpan(
                  text: '${round0(meal.nutrition.caloriesKcal)}',
                  style: dashValue(),
                ),
                const TextSpan(text: ' kcal'),
              ],
            ),
          ),
          if (composition.totalKcal > 0) ...[
            const SizedBox(height: DashboardSpacing.row),
            CompositionBar.compact(segments: composition.segments),
            const SizedBox(height: DashboardSpacing.row),
            MacroScale(macros: macros),
          ],
        ],
      ),
    );
  }
}
