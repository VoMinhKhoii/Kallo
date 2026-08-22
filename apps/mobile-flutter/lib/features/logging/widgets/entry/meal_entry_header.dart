import 'package:flutter/material.dart';

import '../../../../shared/widgets/typography/kallo_text.dart';
import '../../../../theme/kallo_theme.dart';
import 'meal_entry_edit_pill.dart';

/// The unconfirmed card's top line: what the user typed, and the Edit ↔ Done
/// pill.
///
/// The Lora quote is the raw input ONLY — web renders it solely when
/// `userInput` exists (meal-entry.tsx), never a serif meal name.
class MealEntryHeader extends StatelessWidget {
  const MealEntryHeader({
    super.key,
    required this.rawInput,
    required this.editing,
    required this.onToggleEditing,
  });

  final String rawInput;
  final bool editing;
  final VoidCallback onToggleEditing;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start, // items-start
      children: [
        if (rawInput.isNotEmpty)
          Expanded(
            child: KalloText(
              rawInput,
              variant: KalloTextVariant.mealQuote,
              style: const TextStyle(
                fontSize: 17,
                height: 1.625, // leading-relaxed
              ),
            ),
          )
        else
          const Spacer(),
        const SizedBox(width: KalloSpacing.sp2),
        MealEntryEditPill(editing: editing, onTap: onToggleEditing),
      ],
    );
  }
}
