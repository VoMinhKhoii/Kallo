import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../macro_trio.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/logging_models.dart';
import '../../logic/logging_spacing.dart';

class PersistedMealExpandedDetails extends StatelessWidget {
  const PersistedMealExpandedDetails({super.key, required this.meal});

  final PersistedMeal meal;

  @override
  Widget build(BuildContext context) {
    final n = meal.nutrition;
    final groups = [...meal.mealItemGroups]
      ..sort((a, b) => a.order.compareTo(b.order));
    return Padding(
      padding: const EdgeInsets.only(top: LoggingSpacing.section),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Divider(height: 1, thickness: 1, color: KalloColors.borderFaint),
          const SizedBox(height: LoggingSpacing.section),
          Padding(
            padding: const EdgeInsets.only(bottom: LoggingSpacing.section),
            child: Column(
              children: [
                for (final group in groups)
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      vertical: LoggingSpacing.row,
                    ),
                    child: Row(
                      children: [
                        // TWO lines, not one. The macro tail is fixed-width, so
                        // the name gets ~96pt on a 390 phone — under half of
                        // what "Top blade áp chảo" needs (128 measured). At one
                        // line, ordinary Vietnamese dish names ellipsize away
                        // the part that identifies them; the row grows a line
                        // only for the names that need it.
                        Expanded(
                          child: Text(
                            group.name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: dashBody(),
                          ),
                        ),
                        const SizedBox(width: KalloSpacing.sp3), // gap-3
                        MacroTrio(
                          protein: group.nutrition.proteinG,
                          carbs: group.nutrition.carbohydrateG,
                          fat: group.nutrition.fatG,
                          calories: group.nutrition.caloriesKcal,
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const Divider(height: 1, thickness: 1, color: KalloColors.borderFaint),
          const SizedBox(height: LoggingSpacing.section),
          MealTotalsRow(
            label: 'logging.persistedMealCard.total'.tr(),
            protein: n.proteinG,
            carbs: n.carbohydrateG,
            fat: n.fatG,
            calories: n.caloriesKcal,
          ),
        ],
      ),
    );
  }
}
