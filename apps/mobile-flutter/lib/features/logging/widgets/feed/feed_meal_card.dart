import 'package:flutter/material.dart';

import '../../data/logging_models.dart';
import '../cheat_meal_card.dart';
import '../entrances.dart';
import '../persisted/persisted_meal_amount_editor.dart' show AmountEditSave;
import '../persisted/persisted_meal_card.dart';

/// One saved meal in the day's feed — the cheat card or the regular persisted
/// card, whichever the meal is, fading in as it arrives.
class FeedMealCard extends StatelessWidget {
  const FeedMealCard({
    super.key,
    required this.meal,
    required this.isLast,
    required this.onRemove,
    required this.onUpdate,
    required this.onLogAgain,
  });

  final PersistedMeal meal;
  final bool isLast;
  final VoidCallback onRemove;
  final AmountEditSave onUpdate;
  final Future<void> Function() onLogAgain;

  @override
  Widget build(BuildContext context) {
    return FadeIn(
      child:
          meal.isCheat
              ? CheatMealCard(meal: meal, onRemove: onRemove)
              : PersistedMealCard(
                meal: meal,
                isLast: isLast,
                onRemove: onRemove,
                onUpdate: onUpdate,
                onLogAgain: onLogAgain,
              ),
    );
  }
}
