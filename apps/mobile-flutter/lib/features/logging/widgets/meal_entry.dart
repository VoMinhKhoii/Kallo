import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../models/meal.dart';
import '../../../theme/nham_colors.dart';
import '../logic/logging_spacing.dart';
import '../logic/meal_utils.dart';
import 'entrances.dart';
import 'macro_trio.dart';
import 'meal_entry_card.dart';
import 'meal_entry_confirm_button.dart';
import 'meal_entry_header.dart';
import 'meal_entry_item_row.dart';
import 'meal_time_divider.dart';
import 'portion/portion_picker_sheet.dart';

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
  });

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

  /// An unconfirmed meal has no `loggedAt` yet, so the divider shows when the
  /// analysis landed. Captured once at mount rather than read in `build`, so
  /// the time doesn't creep forward every time a stepper rebuilds the card.
  final DateTime _enteredAt = DateTime.now();
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
  /// totals (only the reveal counts up).
  ///
  /// [debounce] re-arms the confirm cooldown. Steppers set it (a fast
  /// double-tap must not slip through and save mid-adjust); the portion picker
  /// does not, matching web, where `handleApply` skips the debounce that
  /// `handleQuantityChange` arms — the sheet dismissal already separates the
  /// two taps.
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

  /// Opens the portion picker for one dish and commits the exact grams it
  /// previewed, alongside the vessel tier that amount may honestly claim.
  Future<void> _adjustPortion(MealItem item) async {
    final vessel = item.vessel;
    if (vessel == null) return;
    final pick = await showPortionPicker(
      context,
      vessel: vessel,
      grams: item.quantity.round(),
      itemCalories: item.macros.calories,
      itemQuantity: item.quantity,
    );
    if (pick == null || !mounted) return;
    // Read the item back out of state: the sheet was open across an await, so
    // the captured `item` may be a stale copy.
    final current = _items.firstWhere(
      (it) => it.id == item.id,
      orElse: () => item,
    );
    _edit(
      () => applyQuantityChange(
        _items,
        _original,
        item.id,
        pick.grams - current.quantity,
      ).map((it) {
        return it.id == item.id ? it.copyWith(vessel: pick.vessel) : it;
      }).toList(),
      debounce: false,
    );
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
        // the one card still awaiting confirmation.
        MealTimeDivider(
          time: DateFormat.jm(context.locale.toString()).format(_enteredAt),
        ),
        const SizedBox(height: LoggingSpacing.block),
        MealEntryCard(
          editing: _editing,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              MealEntryHeader(
                rawInput: widget.rawInput,
                editing: _editing,
                onToggleEditing: () => setState(() => _editing = !_editing),
              ),
              const SizedBox(height: LoggingSpacing.section),
              const Divider(
                height: 1,
                thickness: 1,
                color: NhamColors.borderFaint,
              ),
              const SizedBox(height: LoggingSpacing.section),
              Padding(
                padding: const EdgeInsets.only(bottom: LoggingSpacing.section),
                child: Column(
                  children: [
                    // The entrance lives inside the row widget, wrapping the
                    // dish line only — web's stagger does not carry the
                    // portion trigger with it.
                    for (final (index, item) in _items.indexed)
                      MealEntryItemRow(
                        key: ValueKey(item.id),
                        item: item,
                        index: index,
                        editing: _editing,
                        revealing: widget.revealing,
                        onChange: _change,
                        onAdjustPortion: _adjustPortion,
                      ),
                  ],
                ),
              ),
              const Divider(
                height: 1,
                thickness: 1,
                color: NhamColors.borderFaint,
              ),
              const SizedBox(height: LoggingSpacing.section),
              // The SHARED totals row, not an interpolated `P: … C: … F: …`
              // run. A single run sits wherever its own width puts it, so this
              // line never lined up with the item rows it sums.
              MealTotalsRow(
                label: 'logging.mealEntry.total'.tr(),
                protein: totals.protein,
                carbs: totals.carbs,
                fat: totals.fat,
                calories: totals.calories,
                countUp: _countUp,
              ),
            ],
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
