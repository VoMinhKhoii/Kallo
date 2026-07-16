import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../shared/widgets/nham_text.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../data/logging_models.dart';
import '../logic/format.dart';

class PersistedMealExpandedDetails extends StatelessWidget {
  const PersistedMealExpandedDetails({super.key, required this.meal});

  final PersistedMeal meal;

  @override
  Widget build(BuildContext context) {
    final n = meal.nutrition;
    final groups = [...meal.mealItemGroups]
      ..sort((a, b) => a.order.compareTo(b.order));
    return Padding(
      padding: const EdgeInsets.only(top: NhamSpacing.sp5), // mt-5
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Divider(height: 1, thickness: 1, color: NhamColors.borderFaint),
          const SizedBox(height: NhamSpacing.sp4), // pt-4
          Padding(
            padding: const EdgeInsets.only(bottom: NhamSpacing.sp4), // mb-4
            child: Column(
              children: [
                for (final group in groups)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8), // py-2
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
                            NhamText('P: ${fmtG(group.nutrition.proteinG)}',
                                variant: NhamTextVariant.macroTiny),
                            const SizedBox(width: NhamSpacing.sp2),
                            NhamText(
                                'C: ${fmtG(group.nutrition.carbohydrateG)}',
                                variant: NhamTextVariant.macroTiny),
                            const SizedBox(width: NhamSpacing.sp2),
                            NhamText('F: ${fmtG(group.nutrition.fatG)}',
                                variant: NhamTextVariant.macroTiny),
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
          const SizedBox(height: NhamSpacing.sp3), // pt-3
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              NhamText('logging.persistedMealCard.total'.tr(),
                  variant: NhamTextVariant.calorieBold),
              Row(
                children: [
                  NhamText(
                    'P: ${fmtG(n.proteinG)}  C: ${fmtG(n.carbohydrateG)}  F: ${fmtG(n.fatG)}',
                    variant: NhamTextVariant.captionTabular,
                  ),
                  const SizedBox(width: NhamSpacing.sp4), // gap-4
                  NhamText(fmtKcal(n.caloriesKcal),
                      variant: NhamTextVariant.numStrong),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}
