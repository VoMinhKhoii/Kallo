import 'package:flutter/material.dart';

import '../../../theme/nham_theme.dart';
import '../data/logging_models.dart';
import 'persisted_meal_share_to_circle_button.dart';
import 'persisted_meal_share_with_friends_button.dart';

class PersistedMealActions extends StatelessWidget {
  const PersistedMealActions({super.key, required this.meal});

  final PersistedMeal meal;

  @override
  Widget build(BuildContext context) {
    // Actions: "Share with friends" (copy/split) on the left, the per-meal
    // circle-share toggle on the right (web parity).
    return Padding(
      padding: const EdgeInsets.only(top: NhamSpacing.sp3),
      child: Row(
        children: [
          if (meal.mealItemGroups.isNotEmpty)
            PersistedMealShareWithFriendsButton(mealId: meal.id),
          const Spacer(),
          PersistedMealShareToCircleButton(
            mealId: meal.id,
            share: meal.share,
          ),
        ],
      ),
    );
  }
}
