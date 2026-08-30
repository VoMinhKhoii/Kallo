import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../models/logging/cheat.dart';
import '../../../../models/logging/meal.dart';
import '../../data/logging_models.dart';
import '../../logic/logging_spacing.dart';
import '../cheat/cheat_slider_card.dart';
import '../entry/actions/confirm_meal_removal.dart';
import '../entry/actions/meal_action_icon_button.dart';
import '../entry/meal_entry.dart';
import '../turn/turn_header.dart';

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
    required this.onDiscard,
  });

  final PendingMealConfirmation pending;
  final bool busy;

  final void Function(String analysisId, List<MealQuantityEdit> edits) onConfirm;
  final void Function(String analysisId, CheatSliderLevels levels)
  onConfirmCheat;

  /// Throw the staged analysis away. Its absence was the bug: confirming was
  /// the only exit from one of these, so a meal the user did not want could
  /// only be saved and then deleted, or left to expire.
  final VoidCallback onDiscard;

  @override
  Widget build(BuildContext context) {
    final cheatSpec = pending.cheatSpec;
    // Entries with neither a spec nor a parsed meal never reach here — the feed
    // drops them rather than leaving an empty slot in the list.
    final parsedMeal = pending.parsedMeal;
    if (cheatSpec == null && parsedMeal == null) return const SizedBox.shrink();

    final loggedAt = DateTime.tryParse(pending.loggedAt)?.toLocal();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (cheatSpec != null)
          CheatSliderCard(
            spec: cheatSpec,
            rawInput: pending.rawInput,
            busy: busy,
            onConfirm: (levels) => onConfirmCheat(pending.id, levels),
          )
        else ...[
          // The staged card wears the same turn header as a saved one — the
          // time it was STAGED, not the time this card mounted, and the user's
          // words as a sent message. MealEntry is told not to draw its own
          // divider so there is exactly one.
          TurnHeader(
            time: DateFormat.jm(
              context.locale.toString(),
            ).format(loggedAt ?? DateTime.now()),
            message: pending.rawInput,
          ),
          MealEntry(
            rawInput: pending.rawInput,
            parsedMeal: parsedMeal!,
            // This card has been on the day since it was staged — sometimes
            // for the better part of an hour. Passing the real time is what
            // tells MealEntry not to play its arrival animation every time the
            // list recycles the card back into view.
            loggedAt: loggedAt,
            showTimeDivider: false,
            busy: busy,
            onConfirm: (edits) => onConfirm(pending.id, edits),
          ),
        ],
        // The way out, in the slot a saved card puts its actions in — and
        // outside the branch above, so the cheat slider gets it too without
        // reaching into CheatSliderCard.
        const SizedBox(height: LoggingSpacing.actions),
        Row(
          children: [
            const Spacer(),
            MealActionIconButton(
              icon: LucideIcons.trash2300,
              label: 'logging.stagedMealCard.discard'.tr(),
              danger: true,
              // Inert while a confirm is in flight: the row is about to become
              // a saved meal, and deleting it mid-flight would race that.
              onTap:
                  busy
                      ? null
                      : () async {
                        if (await confirmPendingDiscard(context) &&
                            context.mounted) {
                          onDiscard();
                        }
                      },
            ),
          ],
        ),
      ],
    );
  }
}
