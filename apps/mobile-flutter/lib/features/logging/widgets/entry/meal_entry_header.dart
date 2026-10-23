import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';

/// The unconfirmed card's top line: what the user typed.
///
/// The quote is the raw input ONLY — web renders it solely when `userInput`
/// exists (meal-entry.tsx), never a meal name. Plain 14 since the native pass:
/// the serif belongs to the dashboard greeting, and this line already sits
/// under the same words in the sent bubble above the card.
///
/// It used to share the line with an Edit ↔ Done pill. Editing moved to the
/// meal edit sheet — tap a dish, or hold the card — so the quote has the line
/// to itself.
class MealEntryHeader extends StatelessWidget {
  const MealEntryHeader({super.key, required this.rawInput});

  final String rawInput;

  @override
  Widget build(BuildContext context) {
    if (rawInput.isEmpty) return const SizedBox.shrink();
    return Text(rawInput, style: dashBody());
  }
}
