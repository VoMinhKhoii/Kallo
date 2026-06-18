import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:flutter/services.dart';

import '../../../models/meal.dart';
import '../../../shared/widgets/nham_text.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../logic/format.dart';
import '../logic/meal_utils.dart';
import 'count_up.dart';
import 'dashed_divider.dart';
import 'entrances.dart';
import 'timeline_rail.dart';

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

    return TimelineRail(
      isLast: widget.isLast,
      child: Padding(
        padding: const EdgeInsets.only(bottom: NhamSpacing.sp3), // mb-3
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _Card(
              // The reveal replaces the streaming card in place — matching its
              // surface background removes the background flip at the swap.
              color: widget.revealing ? NhamColors.surface : NhamColors.elev,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header: raw input + edit/done pill.
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start, // items-start
                    children: [
                      Expanded(
                        child: NhamText(
                          widget.rawInput.isNotEmpty
                              ? widget.rawInput
                              : widget.parsedMeal.mealName,
                          variant: NhamTextVariant.mealQuote,
                          style: const TextStyle(
                            fontSize: 17,
                            height: 1.625, // leading-relaxed
                          ),
                        ),
                      ),
                      const SizedBox(width: NhamSpacing.sp2),
                      _EditPill(
                        editing: _editing,
                        onTap: () => setState(() => _editing = !_editing),
                      ),
                    ],
                  ),
                  const SizedBox(height: NhamSpacing.sp5), // mt-5
                  const DashedDivider(color: NhamColors.border),
                  const SizedBox(height: NhamSpacing.sp4), // pt-4
                  Padding(
                    padding: const EdgeInsets.only(bottom: NhamSpacing.sp4),
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
                  const DashedDivider(color: NhamColors.borderHalf),
                  const SizedBox(height: NhamSpacing.sp3), // pt-3
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      NhamText(
                        'logging.mealEntry.total'.tr(),
                        variant: NhamTextVariant.itemName,
                        style: NhamTextStyles.sansBold(
                          fontSize: NhamFontSize.detail,
                        ).copyWith(color: NhamColors.text),
                      ),
                      Row(
                        children: [
                          NhamText(
                            'P: ${fmtG(totals.protein)}  C: ${fmtG(totals.carbs)}  F: ${fmtG(totals.fat)}',
                            variant: NhamTextVariant.captionTabular,
                            style: const TextStyle(color: NhamColors.textMuted),
                          ),
                          const SizedBox(width: NhamSpacing.sp4), // gap-4
                          CountUpText(
                            value: totals.calories,
                            // Reduced motion: the reveal total lands in place.
                            enabled:
                                _countUp &&
                                !MediaQuery.disableAnimationsOf(context),
                            format: (v) => fmtKcal(v),
                            variant: NhamTextVariant.numStrong,
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: NhamSpacing.sp3), // mt-3
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
        ),
      ),
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

    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      padding:
          editing
              ? const EdgeInsets.symmetric(
                vertical: 10,
                horizontal: 8,
              ) // py-2.5 px-2
              : const EdgeInsets.symmetric(vertical: 10),
      decoration:
          editing
              ? BoxDecoration(
                color: NhamColors.surface80, // surface/80
                borderRadius: BorderRadius.circular(NhamRadii.md), // rounded-md
              )
              : null,
      child: Row(
        children: [
          Expanded(
            child: Row(
              children: [
                if (editing)
                  FadeIn(
                    duration: const Duration(milliseconds: 150),
                    child: Row(
                      children: [
                        _Stepper(
                          icon: LucideIcons.minus, // lucide Minus
                          disabled: minusDisabled,
                          onTap:
                              minusDisabled
                                  ? null
                                  : () => onChange(item.id, -step),
                        ),
                        const SizedBox(width: 2), // gap-0.5
                        SizedBox(
                          width: 28,
                          child: NhamText(
                            item.quantity.round().toString(),
                            variant: NhamTextVariant.numStrong,
                            textAlign: TextAlign.center,
                            style: NhamTextStyles.sansSemiBold(
                              fontSize: 11,
                            ).copyWith(color: NhamColors.text),
                          ),
                        ),
                        const SizedBox(width: 2),
                        _Stepper(
                          icon: LucideIcons.plus, // lucide Plus
                          onTap: () => onChange(item.id, step),
                        ),
                        const SizedBox(width: NhamSpacing.sp2), // gap-2
                      ],
                    ),
                  ),
                Expanded(
                  child: NhamText(
                    item.name,
                    variant: NhamTextVariant.itemName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style:
                        struck
                            ? const TextStyle(
                              decoration: TextDecoration.lineThrough,
                              decorationColor: NhamColors.textMuted,
                              color: NhamColors.textMuted,
                            )
                            : null,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: NhamSpacing.sp3), // gap-3
          Opacity(
            opacity: struck ? 0.4 : 1,
            child: Row(
              children: [
                NhamText(
                  'P: ${fmtG(item.macros.protein)}',
                  variant: NhamTextVariant.itemMacro,
                  maxLines: 1,
                ),
                const SizedBox(width: NhamSpacing.sp2),
                NhamText(
                  'C: ${fmtG(item.macros.carbs)}',
                  variant: NhamTextVariant.itemMacro,
                  maxLines: 1,
                ),
                const SizedBox(width: NhamSpacing.sp2),
                NhamText(
                  'F: ${fmtG(item.macros.fat)}',
                  variant: NhamTextVariant.itemMacro,
                  maxLines: 1,
                ),
                const SizedBox(width: NhamSpacing.sp3), // gap-3
                NhamText(
                  fmtKcal(item.macros.calories),
                  variant: NhamTextVariant.itemCalories,
                  maxLines: 1,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A 28x28 (w-7 h-7) stepper button: rounded-md, border/60, white fill.
/// Pressed → bg-nham-hover (the web hover:bg-nham-hover touch affordance).
class _Stepper extends StatefulWidget {
  const _Stepper({required this.icon, this.onTap, this.disabled = false});

  final IconData icon;
  final VoidCallback? onTap;
  final bool disabled;

  @override
  State<_Stepper> createState() => _StepperState();
}

class _StepperState extends State<_Stepper> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final tappable = widget.onTap != null;
    return GestureDetector(
      onTapDown: tappable ? (_) => setState(() => _pressed = true) : null,
      onTapUp: tappable ? (_) => setState(() => _pressed = false) : null,
      onTapCancel: tappable ? () => setState(() => _pressed = false) : null,
      onTap: widget.onTap,
      // 40pt tap target around the 28pt visual stepper (kept under 44 so two
      // steppers + the count value still fit a narrow row without overflow).
      child: SizedBox(
        width: 40,
        height: 40,
        child: Center(
          child: Opacity(
            opacity: widget.disabled ? 0.4 : 1, // opacity-40
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150), // transition-colors
              width: 28,
              height: 28,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: _pressed ? NhamColors.hover : NhamColors.elev,
                borderRadius: BorderRadius.circular(NhamRadii.md),
                border: Border.all(color: NhamColors.borderSoft),
              ),
              child: Icon(widget.icon, size: 10, color: NhamColors.textMuted),
            ),
          ),
        ),
      ),
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
                    ? LucideIcons.check
                    : LucideIcons.pencil, // Check / Pencil
                size: 12,
                color: editing ? NhamColors.accent : NhamColors.textMuted,
              ),
              const SizedBox(width: 6), // gap-1.5
              NhamText(
                editing
                    ? 'logging.mealEntry.done'.tr()
                    : 'logging.mealEntry.edit'.tr(),
                variant: NhamTextVariant.pillLabel,
                style: TextStyle(
                  color: editing ? NhamColors.accent : NhamColors.textMuted,
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
                Icon(LucideIcons.check, size: 14, color: fg),
                const SizedBox(width: 6), // gap-1.5
                NhamText(
                  'logging.confirm'.tr(),
                  variant: NhamTextVariant.body,
                  style: NhamTextStyles.sansMedium(
                    fontSize: NhamFontSize.xs,
                  ).copyWith(color: fg),
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
  const _Card({required this.child, this.color = NhamColors.elev});
  final Widget child;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(NhamSpacing.sp4),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(NhamRadii.containerLg),
        border: Border.all(color: NhamColors.borderSoft),
        boxShadow: const [NhamShadows.sm],
      ),
      child: child,
    );
  }
}
