import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/logging/meal.dart';
import '../../logic/logging_spacing.dart';
import '../../logic/meal_edit/meal_edit_sources.dart';
import '../../logic/meal_utils.dart';
import '../../logic/quantity_editing.dart';
import '../actions/confirm_meal_removal.dart';
import '../actions/meal_hold_menu.dart';
import '../meal_edit/meal_edit_sheet.dart';
import 'meal_entry_card.dart';
import 'meal_entry_confirm_button.dart';
import 'meal_entry_body.dart';
import '../turn/meal_time_divider.dart';

/// An unconfirmed analysis: its dishes, the meal edit sheet they open into
/// (tap a dish, or hold the card), and Log meal.
class MealEntry extends StatefulWidget {
  const MealEntry({
    super.key,
    required this.parsedMeal,
    required this.rawInput,
    required this.onConfirm,
    this.busy = false,
    this.revealing = false,
    this.showTimeDivider = true,
    this.loggedAt,
    this.onDiscard,
  });

  /// Throws the staged analysis away, after a confirm — offered from the
  /// card's hold menu. Null leaves Discard out of the menu.
  final VoidCallback? onDiscard;

  /// When the analysis was staged, for a card restored from the server. Null
  /// for the live reveal, which has not been staged with a time yet.
  final DateTime? loggedAt;

  /// Whether to draw the time divider above the card.
  ///
  /// False for the streaming reveal only: the footer already drew one above the
  /// chat bubble, and a second here would break the timeline's rhythm.
  final bool showTimeDivider;

  final ParsedMeal parsedMeal;
  final String rawInput;
  final ValueChanged<List<MealQuantityEdit>> onConfirm;
  final bool busy;

  /// True for the streaming-reveal morph's first mount: the totals row counts
  /// up and the confirm CTA slides in as the spinner row slides out — the
  /// continuation of the streaming card, not a fresh pop.
  final bool revealing;

  @override
  State<MealEntry> createState() => _MealEntryState();
}

class _MealEntryState extends State<MealEntry> {
  /// The card's editable quantities, and whether they would really be sent.
  late QuantityDraft _draft = QuantityDraft(widget.parsedMeal.items);

  /// What the divider shows. A card staged server-side carries a real
  /// [MealEntry.loggedAt] and must use it: reading the clock instead stamped a
  /// meal analysed at 12:15 with the time the app happened to be REOPENED.
  /// Only the live reveal has no `loggedAt`, and there "now" is right. Seeded
  /// rather than read in `build`, so a stepper cannot creep it forward.
  late DateTime _enteredAt = widget.loggedAt ?? DateTime.now();

  // After the first totals count-up, edits should jump rather than re-animate
  // from zero — only the reveal's opening frame counts up.
  late bool _countUp = widget.revealing;

  /// A re-stage arrives at this very card with a different meal in it — see
  /// [QuantityDraft.sameDishes] — and brings its own staging time. As a
  /// `late final`, [_enteredAt] kept the divider of the analysis it REPLACED.
  @override
  void didUpdateWidget(MealEntry oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (QuantityDraft.sameDishes(oldWidget.parsedMeal, widget.parsedMeal)) {
      return;
    }
    setState(() {
      _draft = QuantityDraft(widget.parsedMeal.items);
      _enteredAt = widget.loggedAt ?? DateTime.now();
    });
  }

  /// Opens the edit sheet on the card's draft. Done hands the re-scaled
  /// dishes back to this card; nothing is sent until Log meal.
  void _openEditor({String? sizeOpen}) {
    // The sheet edits a SNAPSHOT of these items, and a re-stage can land while
    // it is open — committing then would put the superseded analysis's dishes
    // back onto a card that has already moved on.
    final staged = widget.parsedMeal;
    final locale = context.locale.languageCode == 'vi' ? 'vi' : 'en';
    showMealEditSheet(
      context,
      draft: draftFromStaged(_draft.items, _draft.original),
      commitLabel: 'logging.mealEdit.done'.tr(),
      sizeOpen: sizeOpen,
      onCommit: (draft) async {
        if (!mounted || !QuantityDraft.sameDishes(staged, widget.parsedMeal)) {
          return;
        }
        setState(() {
          _countUp = false;
          _draft.items = stagedItemsFrom(draft, _draft.items, locale);
        });
      },
    );
  }

  Future<void> _confirmDiscard() async {
    if (await confirmPendingDiscard(context) && mounted) {
      widget.onDiscard?.call();
    }
  }

  @override
  Widget build(BuildContext context) {
    // Nothing to submit → the SERVER's total, as the saved card shows: summing
    // the per-item macros re-adds figures the API already rounded once each
    // ("490 kcal" staged against "489" saved). Only an edit that will really be
    // sent makes the local sum the right number.
    final totals =
        _draft.dirty
            ? recalculateTotals(_draft.items)
            : widget.parsedMeal.totalMacros;

    // No bottom margin — the feed's list/footer stack owns the gap below.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Same divider a saved card carries, so the timeline doesn't break at
        // the one card still awaiting confirmation. Skipped for the streaming
        // reveal, where the footer already drew one above the chat bubble.
        if (widget.showTimeDivider) ...[
          MealTimeDivider(
            time: DateFormat.jm(context.locale.toString()).format(_enteredAt),
          ),
          const SizedBox(height: LoggingSpacing.block),
        ],
        MealHoldMenu(
          removeLabel: 'logging.stagedMealCard.discard'.tr(),
          onEdit: _openEditor,
          onRemove:
              widget.onDiscard == null || widget.busy ? null : _confirmDiscard,
          child: MealEntryCard(
            child: MealEntryBody(
              rawInput: widget.rawInput,
              items: _draft.items,
              totals: totals,
              revealing: widget.revealing,
              // Only the live turn earns an entrance. A card restored from the
              // server carries a real loggedAt (see [_enteredAt] above) and has
              // been on the day all along — replaying its stagger every time
              // the list recycles it back into view read as the card
              // re-arriving.
              animateIn: widget.loggedAt == null,
              countUp: _countUp,
              onOpen:
                  (item, {bool size = false}) =>
                      _openEditor(sizeOpen: size ? item.id : null),
            ),
          ),
        ),
        // The one thing this card asks for, full width under the content it
        // commits. See [MealEntryCommitRow].
        MealEntryCommitRow(
          revealing: widget.revealing,
          disabled: widget.busy,
          onConfirm: () => widget.onConfirm(_draft.edits),
        ),
      ],
    );
  }
}
