import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import 'meal_entry_edit_pill.dart';

/// The unconfirmed card's top line: what the user typed, and the Edit ↔ Done
/// pill.
///
/// The quote is the raw input ONLY — web renders it solely when `userInput`
/// exists (meal-entry.tsx), never a meal name. Plain 14 since the native pass:
/// the serif belongs to the dashboard greeting, and this line already sits
/// under the same words in the sent bubble above the card.
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
          Expanded(child: Text(rawInput, style: dashBody()))
        else
          const Spacer(),
        const SizedBox(width: KalloSpacing.sp2),
        MealEntryEditPill(editing: editing, onTap: onToggleEditing),
      ],
    );
  }
}
