import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../models/logging/meal.dart';
import '../../logic/logging_spacing.dart';
import '../../logic/meal_utils.dart';
import '../../logic/quantity_editing.dart';
import '../composer/entrances.dart';
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

  /// What the divider shows.
  ///
  /// A card staged server-side carries a real [MealEntry.loggedAt] and must use
  /// it: reading the clock instead stamped a meal analysed at 12:15 with the
  /// time the app happened to be REOPENED, which is how a pending meal from an
  /// hour ago showed up as "just now".
  ///
  /// Only the live reveal has no `loggedAt` yet, and there "now" is right.
  /// Captured once at mount rather than read in `build`, so the time doesn't
  /// creep forward every time a stepper rebuilds the card.
  late final DateTime _enteredAt = widget.loggedAt ?? DateTime.now();
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
  /// [QuantityDraft.sameDishes].
  @override
  void didUpdateWidget(MealEntry oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (QuantityDraft.sameDishes(oldWidget.parsedMeal, widget.parsedMeal)) {
      return;
    }
    setState(() => _draft = QuantityDraft(widget.parsedMeal.items));
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
    final next = await pickPortion(
      context,
      item: item,
      items: _draft.items,
      original: _draft.original,
    );
    if (next != null && mounted) _edit(() => next, debounce: false);
  }

  bool get _confirmDisabled => widget.busy || (_editing && _cooldown.active);

  /// Wrap the confirm CTA in a slide-up entrance only on the reveal morph's
  /// opening frame (the spinner row has just slid out of the same slot).
  Widget _maybeReveal(Widget child) =>
      widget.revealing ? FadeInUp(offset: 12, child: child) : child;

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
        // commits. On reveal it slides up into the spinner row's slot.
        const SizedBox(height: LoggingSpacing.actions),
        _maybeReveal(
          MealEntryConfirmButton(
            editing: _editing,
            disabled: _confirmDisabled,
            onTap:
                _confirmDisabled
                    ? null
                    : () => widget.onConfirm(_draft.edits),
          ),
        ),
        // A staged card's discard: a quiet icon row BENEATH the button, never
        // beside it, where a trash target would read as the confirm's equal.
        if (widget.actions.isNotEmpty) ...[
          const SizedBox(height: LoggingSpacing.actions),
          Row(children: [const Spacer(), ...widget.actions]),
        ],
      ],
    );
  }
}
