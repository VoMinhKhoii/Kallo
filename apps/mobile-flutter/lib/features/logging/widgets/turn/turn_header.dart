import 'package:flutter/widgets.dart';

import '../../logic/logging_spacing.dart';
import 'meal_time_divider.dart';
import 'user_message_bubble.dart';

/// What opens one meal in the feed: the time it was logged, then the user's own
/// words as a sent message.
///
/// Every meal wears this — saved, staged, or still analysing — so the day reads
/// as one conversation rather than as a chat that turns into a list the moment
/// something is saved. The card below keeps its own quote; the repetition is a
/// deliberate, temporary choice.
class TurnHeader extends StatelessWidget {
  const TurnHeader({super.key, required this.time, this.message});

  final String time;

  /// The user's typed words. Null or blank for meals with nothing to quote —
  /// a barcode scan, say — which then show the divider alone.
  final String? message;

  @override
  Widget build(BuildContext context) {
    final text = message?.trim();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        MealTimeDivider(time: time),
        const SizedBox(height: LoggingSpacing.turn),
        if (text != null && text.isNotEmpty) ...[
          UserMessageBubble(text: text),
          const SizedBox(height: LoggingSpacing.turn),
        ],
      ],
    );
  }
}
