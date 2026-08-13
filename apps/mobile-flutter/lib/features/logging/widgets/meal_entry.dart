import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../models/meal.dart';
import '../logic/logging_spacing.dart';
import '../logic/meal_utils.dart';
import 'entrances.dart';
import 'meal_entry_card.dart';
import 'meal_entry_confirm_button.dart';
import 'meal_entry_body.dart';
import 'meal_time_divider.dart';
import 'portion/portion_pick_flow.dart';

// Briefly block Confirm after a quantity tap so a fast double-tap on a stepper
// can't slip through and save before the user is done adjusting.
const _confirmDebounce = Duration(milliseconds: 300);

/// An unconfirmed analysis: editable dish quantities (+/- steppers) + confirm.
/// Reuses the web's pure quantity helpers so scaling math is identical.
class MealEntry extends StatefulWidget {
  const MealEntry({
    super.key,
    required this.parsedMeal,
    required this.rawInput,
    required this.onConfirm,
    this.busy = false,
    this.isLast = false,
    this.revealing = false,
    this.showTimeDivider = true,
    this.loggedAt,
  });

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
  final bool isLast;

  /// True for the streaming-reveal morph's first mount: the totals row counts
  /// up and the confirm CTA slides in as the spinner row slides out — the
  /// continuation of the streaming card, not a fresh pop.
  final bool revealing;

  @override
  State<MealEntry> createState() => _MealEntryState();
}

class _MealEntryState extends State<MealEntry> {
  late List<MealItem> _items = widget.parsedMeal.items;
  late final List<MealItem> _original = widget.parsedMeal.items;

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
  bool _confirmCoolingDown = false;
  Timer? _confirmTimer;
  // After the first totals count-up, edits should jump rather than re-animate
  // from zero — only the reveal's opening frame counts up.
  late bool _countUp = widget.revealing;

  @override
  void dispose() {
    _confirmTimer?.cancel();
    super.dispose();
  }

  void _change(String itemId, double delta) {
    HapticFeedback.selectionClick();
    _edit(() => applyQuantityChange(_items, _original, itemId, delta));
  }

  /// Every quantity edit — stepper or portion picker — lands here: it snaps the
  /// totals (only the reveal counts up) and, when [debounce] is set, re-arms
  /// the confirm cooldown so a fast double-tap can't save mid-adjust.
  void _edit(List<MealItem> Function() mutate, {bool debounce = true}) {
    setState(() {
      _countUp = false;
      _items = mutate();
      if (debounce) _confirmCoolingDown = true;
    });
    if (!debounce) return;
    _confirmTimer?.cancel();
    _confirmTimer = Timer(_confirmDebounce, () {
      if (mounted) setState(() => _confirmCoolingDown = false);
    });
  }

  /// Commits whatever the portion picker previewed. No debounce, matching web's
  /// `handleApply`: dismissing the sheet already separates this from Confirm.
  Future<void> _adjustPortion(MealItem item) async {
    final next = await pickPortion(
      context,
      item: item,
      items: _items,
      original: _original,
    );
    if (next != null && mounted) _edit(() => next, debounce: false);
  }

  bool get _confirmDisabled => widget.busy || (_editing && _confirmCoolingDown);

  /// Wrap the confirm CTA in a slide-up entrance only on the reveal morph's
  /// opening frame (the spinner row has just slid out of the same slot).
  Widget _maybeReveal(Widget child) =>
      widget.revealing ? FadeInUp(offset: 12, child: child) : child;

  @override
  Widget build(BuildContext context) {
    final totals = recalculateTotals(_items);

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
            items: _items,
            totals: totals,
            editing: _editing,
            revealing: widget.revealing,
            countUp: _countUp,
            onToggleEditing: () => setState(() => _editing = !_editing),
            onChange: _change,
            onAdjustPortion: _adjustPortion,
          ),
        ),
        const SizedBox(height: LoggingSpacing.block),
        // On reveal the CTA slides up into the slot the spinner row vacated.
        _maybeReveal(
          MealEntryConfirmButton(
            editing: _editing,
            disabled: _confirmDisabled,
            onTap:
                _confirmDisabled
                    ? null
                    : () => widget.onConfirm(
                      deriveQuantityEdits(_items, _original),
                    ),
          ),
        ),
      ],
    );
  }
}
