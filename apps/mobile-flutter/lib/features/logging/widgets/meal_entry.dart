import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:flutter/services.dart';

import '../../../models/meal.dart';
import '../../../shared/widgets/nham_text.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../logic/logging_spacing.dart';
import '../logic/meal_utils.dart';
import 'entrances.dart';
import 'macro_trio.dart';
import 'meal_stepper_button.dart';
import 'meal_time_divider.dart';

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
    setState(() {
      _countUp = false; // a manual edit snaps; only the reveal counts up
      _items = applyQuantityChange(_items, _original, itemId, delta);
      _confirmCoolingDown = true;
    });
    _confirmTimer?.cancel();
    _confirmTimer = Timer(_confirmDebounce, () {
      if (mounted) setState(() => _confirmCoolingDown = false);
    });
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
        _Card(
          // The reveal replaces the streaming card in place — matching its
          // surface background removes the background flip at the swap.
          color: widget.revealing ? NhamColors.surface : NhamColors.elev,
          editing: _editing,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header: raw input + edit/done pill. The Lora quote is the
              // user's raw input ONLY — web renders it solely when
              // `userInput` exists (meal-entry.tsx), never a serif meal name.
              Row(
                crossAxisAlignment: CrossAxisAlignment.start, // items-start
                children: [
                  if (widget.rawInput.isNotEmpty)
                    Expanded(
                      child: NhamText(
                        widget.rawInput,
                        variant: NhamTextVariant.mealQuote,
                        style: const TextStyle(
                          fontSize: 17,
                          height: 1.625, // leading-relaxed
                        ),
                      ),
                    )
                  else
                    const Spacer(),
                  const SizedBox(width: NhamSpacing.sp2),
                  _EditPill(
                    editing: _editing,
                    onTap: () => setState(() => _editing = !_editing),
                  ),
                ],
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
                    for (final (index, item) in _items.indexed)
                      // Web: each item enters opacity 0→1, x:-8→0, staggered
                      // delay index*0.05s (meal-entry-item.tsx:32-35). On
                      // the reveal the rows were already on screen in the
                      // streaming card — crossfade in place, don't re-enter.
                      if (widget.revealing)
                        FadeIn(
                          key: ValueKey(item.id),
                          duration: const Duration(milliseconds: 150),
                          child: _ItemRow(
                            item: item,
                            editing: _editing,
                            onChange: _change,
                          ),
                        )
                      else
                        FadeInLeft(
                          key: ValueKey(item.id),
                          offset: 8,
                          delay: Duration(milliseconds: index * 50),
                          child: _ItemRow(
                            item: item,
                            editing: _editing,
                            onChange: _change,
                          ),
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
          _ConfirmButton(
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

class _ItemRow extends StatelessWidget {
  const _ItemRow({
    required this.item,
    required this.editing,
    required this.onChange,
  });

  final MealItem item;
  final bool editing;
  final void Function(String itemId, double delta) onChange;

  @override
  Widget build(BuildContext context) {
    final isGrams = item.unit == 'g' || item.unit == 'ml';
    final step = isGrams ? 10.0 : 1.0;
    final minusDisabled =
        isGrams ? item.quantity <= minDishGrams : item.quantity <= 0;
    // Stepping a count-unit item to 0 strikes the row — a clear "this one's
    // out" cue before confirm drops it. Grams floor at minDishGrams, so only
    // count units can reach 0.
    final struck = !isGrams && item.quantity <= 0;

    // No wash, no inset. The row's geometry is IDENTICAL in both modes — only
    // the middle block's contents change — so tapping Edit doesn't shuffle the
    // card. What tells you the card is editable is the card itself: its border
    // goes to the accent the app already uses for a focused input.
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: LoggingSpacing.row),
      child: Row(
        children: [
          // TWO lines, and the SAME column whether or not you are editing. The
          // macro tail is fixed-width, so the name gets ~104pt on a phone — on
          // one line "Sữa chua uống berries" ellipsised to "Sữa chua uống ber…",
          // losing the part that identifies it.
          Expanded(
            child: Text(
              item.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: dashBody().merge(
                struck
                    ? const TextStyle(
                      decoration: TextDecoration.lineThrough,
                      decorationColor: kInkMuted,
                      color: kInkMuted,
                    )
                    : null,
              ),
            ),
          ),
          const SizedBox(width: NhamSpacing.sp3), // gap-3
          // The SHARED trio, not a hand-rolled Row. Content-sized cells put
          // `C:` at a different x on every row — `P: 0g` and `P: 49g` are not
          // the same width — so a card of items read as ragged. MacroTrio pins
          // each macro to a fixed cell and scales the value down inside it
          // rather than clipping.
          //
          // Editing swaps the P/C/F block for the steppers IN PLACE. They are
          // the control for the number the row is about, and they sit in the
          // middle rather than in front of the name so nothing else moves.
          Opacity(
            opacity: struck ? 0.4 : 1,
            child: MacroTrio(
              protein: item.macros.protein,
              carbs: item.macros.carbs,
              fat: item.macros.fat,
              calories: item.macros.calories,
              splitReplacement:
                  editing
                      ? _QuantityStepper(
                        quantity: item.quantity,
                        minusDisabled: minusDisabled,
                        onChange: (delta) => onChange(item.id, delta),
                        step: step,
                      )
                      : null,
            ),
          ),
        ],
      ),
    );
  }
}

/// `−  180  +` for one row, centred in the slot the P/C/F block vacates.
///
/// Centred rather than packed left because the block it replaces is wider than
/// it is (140 against 104): pinning it to either edge would leave a lopsided
/// gap that reads as a layout bug rather than as a control.
class _QuantityStepper extends StatelessWidget {
  const _QuantityStepper({
    required this.quantity,
    required this.minusDisabled,
    required this.onChange,
    required this.step,
  });

  final double quantity;
  final bool minusDisabled;
  final ValueChanged<double> onChange;
  final double step;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        MealStepperButton(
          icon: LucideIcons.minus300, // lucide Minus
          disabled: minusDisabled,
          onTap: minusDisabled ? null : () => onChange(-step),
        ),
        const SizedBox(width: 2), // gap-0.5
        SizedBox(
          width: 28,
          child: Text(
            quantity.round().toString(),
            textAlign: TextAlign.center,
            style: dashMeta(color: kInk, tabular: true),
          ),
        ),
        const SizedBox(width: 2),
        MealStepperButton(
          icon: LucideIcons.plus300, // lucide Plus
          onTap: () => onChange(step),
        ),
      ],
    );
  }
}

/// Edit ↔ Done pill. Keyed swap pops with a scale-in (RN AnimatePresence).
class _EditPill extends StatelessWidget {
  const _EditPill({required this.editing, required this.onTap});

  final bool editing;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    // AnimatePresence mode=wait: the whole pill (border/bg + content) is the
    // swapped node, scaling+fading 0.85→1 over 150ms (meal-entry.tsx:126-166).
    return GestureDetector(
      onTap: onTap,
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 150),
        transitionBuilder: (child, animation) {
          return FadeTransition(
            opacity: animation,
            child: ScaleTransition(
              scale: Tween<double>(begin: 0.85, end: 1).animate(animation),
              child: child,
            ),
          );
        },
        child: Container(
          key: ValueKey(editing ? 'done' : 'edit'),
          padding: const EdgeInsets.symmetric(
            vertical: 4,
            horizontal: 10,
          ), // py-1 px-2.5
          decoration: BoxDecoration(
            color: editing ? NhamColors.accent10 : Colors.transparent,
            borderRadius: BorderRadius.circular(NhamRadii.pill),
            border: Border.all(
              color: editing ? NhamColors.accent50 : NhamColors.borderSoft,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                editing
                    ? LucideIcons.check300
                    : LucideIcons.pencil300, // Check / Pencil
                size: 12,
                color: editing ? NhamColors.text : NhamColors.textMuted,
              ),
              const SizedBox(width: 6), // gap-1.5
              Text(
                editing
                    ? 'logging.mealEntry.done'.tr()
                    : 'logging.mealEntry.edit'.tr(),
                style: dashMeta().merge(
                  TextStyle(color: editing ? NhamColors.text : kInkMuted),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Confirm CTA below the card. Editing → ghost (btn/40 border); else → solid btn.
/// Pressed mirrors the web hover: solid → btn-hover bg + shadow-md; ghost →
/// btn border + btn/5 bg. transition-all duration-200.
class _ConfirmButton extends StatefulWidget {
  const _ConfirmButton({
    required this.editing,
    required this.disabled,
    required this.onTap,
  });

  final bool editing;
  final bool disabled;
  final VoidCallback? onTap;

  @override
  State<_ConfirmButton> createState() => _ConfirmButtonState();
}

class _ConfirmButtonState extends State<_ConfirmButton> {
  bool _pressed = false;

  static const Color _btn5 = Color(0x0D695E4E); // btn umber @ 5%

  @override
  Widget build(BuildContext context) {
    final editing = widget.editing;
    final tappable = widget.onTap != null;
    final active = _pressed && tappable;
    final fg = editing ? NhamColors.btn : Colors.white;

    final Color bg;
    if (editing) {
      bg = active ? _btn5 : Colors.transparent;
    } else {
      bg = active ? NhamColors.btnHover : NhamColors.btn;
    }
    final BoxBorder? border =
        editing
            ? Border.all(
              color: active ? NhamColors.btn : NhamColors.btnBorderGhost,
            )
            : null;
    final List<BoxShadow>? shadow =
        editing ? null : [active ? NhamShadows.md : NhamShadows.sm];

    return Semantics(
      button: true,
      enabled: tappable,
      excludeSemantics: true,
      label: 'logging.confirm'.tr(),
      onTap: widget.onTap,
      child: Opacity(
        opacity: widget.disabled ? 0.5 : 1, // opacity-50
        child: GestureDetector(
          onTapDown: tappable ? (_) => setState(() => _pressed = true) : null,
          onTapUp: tappable ? (_) => setState(() => _pressed = false) : null,
          onTapCancel: tappable ? () => setState(() => _pressed = false) : null,
          onTap: widget.onTap,
          child: AnimatedContainer(
            duration: const Duration(
              milliseconds: 200,
            ), // transition-all duration-200
            padding: const EdgeInsets.symmetric(
              vertical: 10,
              horizontal: 12,
            ), // py-2.5 px-3
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(NhamRadii.xl), // rounded-xl
              border: border,
              boxShadow: shadow,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(LucideIcons.check300, size: 14, color: fg),
                const SizedBox(width: 6), // gap-1.5
                Text(
                  'logging.confirm'.tr(),
                  style: dashBody(color: fg, weight: FontWeight.w500),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Card: rounded-2xl (16px), border/60 hairline, shadow.sm, padding 16.
/// [color] lets the reveal match the streaming card's surface background.
class _Card extends StatelessWidget {
  const _Card({
    required this.child,
    this.color = NhamColors.elev,
    this.editing = false,
  });
  final Widget child;
  final Color color;

  /// Editing lifts the hairline to the accent this app already uses for a
  /// focused input, on the WHOLE card.
  ///
  /// It replaces a grey wash behind each row, which said "these three rows are
  /// something" without saying what, cost every row an 8pt inset that shifted
  /// its contents, and repeated the message once per item. Ringing the card
  /// states it once, in the app's existing vocabulary for "this is live", and
  /// moves nothing.
  final bool editing;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 150), // transition-colors
      padding: LoggingSpacing.card,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(NhamRadii.containerLg),
        border: Border.all(
          color: editing ? NhamColors.accent40 : NhamColors.borderSoft,
        ),
        boxShadow: const [NhamShadows.sm],
      ),
      child: child,
    );
  }
}
