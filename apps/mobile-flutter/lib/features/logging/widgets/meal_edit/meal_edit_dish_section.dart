import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/logic/display_format.dart';
import '../../../../shared/widgets/list/grouped_list_card.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/format.dart';
import '../../logic/meal_edit/meal_edit_draft.dart';
import '../../logic/meal_edit/meal_edit_format.dart';
import 'meal_edit_size_row.dart';
import 'meal_edit_stepper_row.dart';

/// One dish in the edit sheet: its name and calories, then a grouped card of
/// Servings, Amount and — when the pipeline pictured it in a vessel — Size.
///
/// No ingredient rows: a dish scales as one thing (the owner's ruling), so the
/// sheet never asks the user to weigh the rice apart from the chicken.
class MealEditDishSection extends StatelessWidget {
  const MealEditDishSection({
    super.key,
    required this.draft,
    required this.dish,
    required this.sizeOpen,
    required this.onDraft,
    required this.onToggleSize,
  });

  final MealEditDraft draft;
  final EditDish dish;
  final bool sizeOpen;
  final ValueChanged<MealEditDraft> onDraft;
  final VoidCallback onToggleSize;

  @override
  Widget build(BuildContext context) {
    final locale = localeOf(context);
    final named = {'name': dish.name};
    final removes = draft.removesOnMinus(dish);
    final vessel = dish.vessel;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, KalloSpacing.sp5, 4, 8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  dish.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: kSectionHeader(),
                ),
              ),
              const SizedBox(width: KalloSpacing.sp3),
              Text(
                fmtKcal(dish.totals.kcal, locale: locale),
                style: dashMeta(),
              ),
            ],
          ),
        ),
        GroupedListCard(
          separatorInset: 0,
          children: [
            MealEditStepperRow(
              label: 'logging.mealEdit.servings'.tr(),
              value: formatTimes(dish.servings, locale),
              minusRemoves: removes,
              minusLabel:
                  removes
                      ? 'logging.mealEdit.removeDish'.tr(namedArgs: named)
                      : 'logging.mealEdit.lessServing'.tr(namedArgs: named),
              plusLabel: 'logging.mealEdit.moreServing'.tr(namedArgs: named),
              onMinus:
                  draft.servingsMinusDisabled(dish)
                      ? null
                      : () => onDraft(draft.stepServings(dish.key, -1)),
              // A dish logged with no grams cannot grow — only come out.
              onPlus:
                  dish.scalable
                      ? () => onDraft(draft.stepServings(dish.key, 1))
                      : null,
            ),
            if (dish.scalable)
              MealEditStepperRow(
                label: 'logging.mealEdit.amount'.tr(),
                value: formatAmount(dish.grams, dish.unit, locale),
                minusLabel: 'logging.mealEdit.lessAmount'.tr(namedArgs: named),
                plusLabel: 'logging.mealEdit.moreAmount'.tr(namedArgs: named),
                onMinus:
                    dish.grams <= dish.floor
                        ? null
                        : () => onDraft(draft.stepAmount(dish.key, -1)),
                onPlus: () => onDraft(draft.stepAmount(dish.key, 1)),
              ),
            if (vessel != null)
              MealEditSizeRow(
                vessel: vessel,
                grams: dish.grams,
                open: sizeOpen,
                onToggle: onToggleSize,
                onGrams: (g) => onDraft(draft.setGrams(dish.key, g.toDouble())),
              ),
          ],
        ),
      ],
    );
  }
}
