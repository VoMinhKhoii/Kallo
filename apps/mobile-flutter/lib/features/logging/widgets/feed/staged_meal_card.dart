import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';

import '../../../../models/cheat.dart';
import '../../../../models/meal.dart';
import '../../data/logging_models.dart';
import '../cheat_slider_card.dart';
import '../meal_entry.dart';
import '../turn_header.dart';

/// One analysis the SERVER has staged but the user hasn't confirmed yet.
///
/// A different thing from the live turn in the footer: these are restored from
/// `GET /api/v1/logging/day` on every load, so they survive a relaunch and
/// carry their own `loggedAt` — which is why the header is stamped from that
/// rather than from the clock. They sit in the day's list among the saved
/// meals, in the order everything was logged.
class StagedMealCard extends StatelessWidget {
  const StagedMealCard({
    super.key,
    required this.pending,
    required this.busy,
    required this.onConfirm,
    required this.onConfirmCheat,
  });

  final PendingMealConfirmation pending;
  final bool busy;

  final void Function(String analysisId, List<MealQuantityEdit> edits) onConfirm;
  final void Function(String analysisId, CheatSliderLevels levels)
  onConfirmCheat;

  @override
  Widget build(BuildContext context) {
    if (pending.cheatSpec case final cheatSpec?) {
      return CheatSliderCard(
        spec: cheatSpec,
        rawInput: pending.rawInput,
        busy: busy,
        onConfirm: (levels) => onConfirmCheat(pending.id, levels),
      );
    }
    // Entries with neither a spec nor a parsed meal never reach here — the feed
    // drops them rather than leaving an empty slot in the list.
    final parsedMeal = pending.parsedMeal;
    if (parsedMeal == null) return const SizedBox.shrink();

    final loggedAt = DateTime.tryParse(pending.loggedAt)?.toLocal();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // The staged card wears the same turn header as a saved one — the time
        // it was STAGED, not the time this card mounted, and the user's words
        // as a sent message. MealEntry is told not to draw its own divider so
        // there is exactly one.
        TurnHeader(
          time: DateFormat.jm(
            context.locale.toString(),
          ).format(loggedAt ?? DateTime.now()),
          message: pending.rawInput,
        ),
        MealEntry(
          rawInput: pending.rawInput,
          parsedMeal: parsedMeal,
          showTimeDivider: false,
          busy: busy,
          onConfirm: (edits) => onConfirm(pending.id, edits),
        ),
      ],
    );
  }
}
