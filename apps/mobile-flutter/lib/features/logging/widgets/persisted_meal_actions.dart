import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../circle/widgets/share_meal_sheet.dart';
import '../data/logging_models.dart';
import 'meal_action_icon_button.dart';
import 'persisted_meal_share_to_circle_button.dart';

class PersistedMealActions extends StatelessWidget {
  const PersistedMealActions({
    super.key,
    required this.meal,
    required this.onRemove,
  });

  final PersistedMeal meal;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        if (meal.mealItemGroups.isNotEmpty)
          MealActionIconButton(
            icon: LucideIcons.userPlus,
            label: 'logging.persistedMealCard.shareWithFriends'.tr(),
            onTap: () => showShareMealSheet(context, meal.id),
          ),
        const Spacer(),
        PersistedMealShareToCircleButton(mealId: meal.id, share: meal.share),
        if (onRemove != null)
          MealActionIconButton(
            icon: LucideIcons.trash2,
            label: 'logging.remove'.tr(),
            danger: true,
            onTap: onRemove,
          ),
      ],
    );
  }
}
