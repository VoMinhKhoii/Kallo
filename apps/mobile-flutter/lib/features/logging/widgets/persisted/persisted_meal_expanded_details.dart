import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/widgets/nham_text.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import '../../data/logging_models.dart';
import '../../logic/format.dart';
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
          const Divider(height: 1, thickness: 1, color: NhamColors.borderFaint),
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
                        Expanded(
                          child: NhamText(
                            group.name,
                            variant: NhamTextVariant.itemName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: NhamSpacing.sp3), // gap-3
                        Row(
                          children: [
                            NhamText(
                              'P: ${fmtG(group.nutrition.proteinG)}',
                              variant: NhamTextVariant.macroTiny,
                            ),
                            const SizedBox(width: NhamSpacing.sp2),
                            NhamText(
                              'C: ${fmtG(group.nutrition.carbohydrateG)}',
                              variant: NhamTextVariant.macroTiny,
                            ),
                            const SizedBox(width: NhamSpacing.sp2),
                            NhamText(
                              'F: ${fmtG(group.nutrition.fatG)}',
                              variant: NhamTextVariant.macroTiny,
                            ),
                            const SizedBox(width: NhamSpacing.sp3), // gap-3
                            NhamText(
                              fmtKcal(group.nutrition.caloriesKcal),
                              variant: NhamTextVariant.calorieBold,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const Divider(height: 1, thickness: 1, color: NhamColors.borderFaint),
          const SizedBox(height: LoggingSpacing.section),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              NhamText(
                'logging.persistedMealCard.total'.tr(),
                variant: NhamTextVariant.calorieBold,
              ),
              Row(
                children: [
                  NhamText(
                    'P: ${fmtG(n.proteinG)}  C: ${fmtG(n.carbohydrateG)}  F: ${fmtG(n.fatG)}',
                    variant: NhamTextVariant.captionTabular,
                  ),
                  const SizedBox(width: NhamSpacing.sp4), // gap-4
                  NhamText(
                    fmtKcal(n.caloriesKcal),
                    variant: NhamTextVariant.numStrong,
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}
