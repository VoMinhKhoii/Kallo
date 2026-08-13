import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';

import '../../../../models/cheat.dart';
import '../../../../models/meal.dart';
import '../../data/logging_models.dart';
import '../../logic/logging_spacing.dart';
import '../cheat_slider_card.dart';
import '../meal_entry.dart';
import '../turn_header.dart';

/// The analyses the SERVER has staged but the user hasn't confirmed yet.
///
/// A different thing from the live turn below it: these are restored from
/// `GET /api/v1/logging/day` on every load, so they survive a relaunch and
/// carry their own `loggedAt` — which is why they stamp their turn header from
/// that rather than from the clock.
///
/// They disappear 30 minutes after staging: the server only returns rows whose
/// `expiresAt` is still in the future, so an abandoned analysis cannot come
/// back as an unsaved duplicate of a meal that was already saved.
class PendingConfirmationCards extends StatelessWidget {
  const PendingConfirmationCards({
    super.key,
    required this.pending,
    required this.busy,
    required this.tailIsBusy,
    required this.onConfirm,
    required this.onConfirmCheat,
  });

  final List<PendingMealConfirmation> pending;
  final bool busy;

  /// Whether anything renders BELOW these cards (a live turn or a failure), so
  /// the last one knows whether it is really last.
  final bool tailIsBusy;

  final void Function(String analysisId, List<MealQuantityEdit> edits) onConfirm;
  final void Function(String analysisId, CheatSliderLevels levels)
  onConfirmCheat;

  @override
  Widget build(BuildContext context) {
    // The index of the last entry that actually RENDERS. An entry with neither
    // a cheatSpec nor a parsedMeal draws nothing, so comparing against
    // `length - 1` would hand `isLast` to no one whenever such an entry sits at
    // the end of the list.
    final lastRendered = pending.lastIndexWhere(
      (p) => p.cheatSpec != null || p.parsedMeal != null,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: LoggingSpacing.block,
      children: [
        for (var i = 0; i < pending.length; i++)
          if (pending[i].cheatSpec case final cheatSpec?)
            CheatSliderCard(
              key: ValueKey(pending[i].id),
              spec: cheatSpec,
              rawInput: pending[i].rawInput,
              busy: busy,
              onConfirm: (levels) => onConfirmCheat(pending[i].id, levels),
            )
          else if (pending[i].parsedMeal case final parsedMeal?)
            Column(
              key: ValueKey(pending[i].id),
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // The staged card wears the same turn header as a saved one —
                // the time it was STAGED, not the time this card mounted, and
                // the user's words as a sent message. MealEntry is told not to
                // draw its own divider so there is exactly one.
                TurnHeader(
                  time: DateFormat.jm(context.locale.toString()).format(
                    DateTime.tryParse(pending[i].loggedAt)?.toLocal() ??
                        DateTime.now(),
                  ),
                  message: pending[i].rawInput,
                ),
                MealEntry(
                  rawInput: pending[i].rawInput,
                  parsedMeal: parsedMeal,
                  showTimeDivider: false,
                  busy: busy,
                  isLast: !tailIsBusy && i == lastRendered,
                  onConfirm: (edits) => onConfirm(pending[i].id, edits),
                ),
              ],
            ),
      ],
    );
  }
}
