import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../models/logging/meal.dart';
import '../../logic/logging_spacing.dart';
import '../../logic/meal_utils.dart';
import '../../logic/quantity_editing.dart';
import 'meal_entry_card.dart';
import 'meal_entry_confirm_button.dart';
import 'meal_entry_body.dart';
import '../turn/meal_time_divider.dart';
import '../portion/portion_pick_flow.dart';

/// An unconfirmed analysis: editable dish quantities (+/- steppers) + confirm.
/// Reuses the web's pure quantity helpers so scaling math is identical.
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
    this.actions = const [],
  });

  /// Extra action targets for the quiet icon row BENEATH the confirm pill — a
  /// staged card's discard lives here. Empty means no second row is drawn at
  /// all.
  final List<Widget> actions;

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
  bool _editing = false;

  /// Confirm waits a beat after each tap; [dispose] cancels the window, so it
  /// can never settle onto a dead State. See [ConfirmCooldown].
  late final ConfirmCooldown _cooldown = ConfirmCooldown(() => setState(() {}));
  // After the first totals count-up, edits should jump rather than re-animate
  // from zero — only the reveal's opening frame counts up.
  late bool _countUp = widget.revealing;

  @override
  void dispose() {
    _cooldown.dispose();
    super.dispose();
  }

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

  void _change(String itemId, double delta) {
    HapticFeedback.selectionClick();
    _edit(() => _draft.changed(itemId, delta));
  }

  /// Every quantity edit — stepper or portion picker — lands here: it snaps the
  /// totals (only the reveal counts up) and, when [debounce] is set, re-arms
  /// the confirm cooldown so a fast double-tap can't save mid-adjust.
  void _edit(List<MealItem> Function() mutate, {bool debounce = true}) {
    setState(() {
      _countUp = false;
      _draft.items = mutate();
    });
    if (debounce) _cooldown.arm();
  }

  /// Commits whatever the portion picker previewed. No debounce, matching web's
  /// `handleApply`: dismissing the sheet already separates this from Confirm.
  Future<void> _adjustPortion(MealItem item) async {
    // The picker answers from a SNAPSHOT of these items, and a re-stage can
    // land while it is open — committing then would put the superseded
    // analysis's dishes back onto a card that has already moved on.
    final staged = widget.parsedMeal;
    final next = await pickPortion(
      context,
      item: item,
      items: _draft.items,
      original: _draft.original,
    );
    if (next == null || !mounted) return;
    if (!QuantityDraft.sameDishes(staged, widget.parsedMeal)) return;
    _edit(() => next, debounce: false);
  }

  bool get _confirmDisabled => widget.busy || (_editing && _cooldown.active);

  @override
  Widget build(BuildContext context) {
    // Nothing to submit → the SERVER's total, as the saved card shows: summing
    // the per-item macros re-adds figures the API already rounded once each
    // ("490 kcal" staged against "489" saved). Only an edit that will really be
    // sent makes the local sum the right number.
    final totals = _draft.dirty
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
        MealEntryCard(
          editing: _editing,
          child: MealEntryBody(
            rawInput: widget.rawInput,
            items: _draft.items,
            totals: totals,
            editing: _editing,
            revealing: widget.revealing,
            // Only the live turn earns an entrance. A card restored from the
            // server carries a real loggedAt (see [_enteredAt] above) and has
            // been on the day all along — replaying its stagger every time the
            // list recycles it back into view read as the card re-arriving.
            animateIn: widget.loggedAt == null,
            countUp: _countUp,
            onToggleEditing: () => setState(() => _editing = !_editing),
            onChange: _change,
            onAdjustPortion: _adjustPortion,
          ),
        ),
        // The one thing this card asks for, full width under the content it
        // commits. See [MealEntryCommitRow].
        MealEntryCommitRow(
          editing: _editing,
          revealing: widget.revealing,
          disabled: _confirmDisabled,
          onConfirm: () => widget.onConfirm(_draft.edits),
          actions: widget.actions,
        ),
      ],
    );
  }
}
