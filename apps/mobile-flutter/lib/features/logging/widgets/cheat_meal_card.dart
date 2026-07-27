import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../shared/widgets/nham_text.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../data/logging_models.dart';
import '../logic/format.dart';
import '../logic/logging_spacing.dart';
import 'cheat_meal_expanded_details.dart';
import 'cheat_slider_card.dart' show CheatBadge;
import 'confirm_meal_removal.dart';
import 'persisted/persisted_meal_time_divider.dart';
import 'meal_action_icon_button.dart';

/// A saved cheat meal in the day's feed — accent-tinted (never red), the
/// PartyPopper badge, an `≈`-prefixed calorie total, and an expandable
/// "you set" recap of the slider positions with a reassurance line.
///
/// Ported from `components/logging/feed/cheat/cheat-meal-card.tsx`, using the
/// mobile persisted card's interaction shell (time divider, chevron expand,
/// trailing-swipe removal).
class CheatMealCard extends StatefulWidget {
  const CheatMealCard({super.key, required this.meal, this.onRemove});

  final PersistedMeal meal;

  /// Removal (terracotta, never red) — fired by the trailing swipe or the
  /// remove icon beneath the card. Null disables both.
  final VoidCallback? onRemove;

  @override
  State<CheatMealCard> createState() => _CheatMealCardState();
}

class _CheatMealCardState extends State<CheatMealCard>
    with SingleTickerProviderStateMixin {
  bool _collapsed = true;

  late final AnimationController _expand = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 200),
  );

  // Built once (not per build): a CurvedAnimation holds a listener on its
  // parent, so re-creating it each build would orphan listeners on _expand.
  late final CurvedAnimation _curvedExpand = CurvedAnimation(
    parent: _expand,
    curve: Curves.easeInOut,
  );

  void _toggle() {
    setState(() => _collapsed = !_collapsed);
    if (_collapsed) {
      _expand.reverse();
    } else {
      _expand.forward();
    }
  }

  @override
  void dispose() {
    _curvedExpand.dispose();
    _expand.dispose();
    super.dispose();
  }

  Widget _maybeDismissible(Widget card) {
    final onRemove = widget.onRemove;
    if (onRemove == null) return card;
    return Dismissible(
      key: ValueKey('dismiss-${widget.meal.id}'),
      direction: DismissDirection.endToStart,
      confirmDismiss: (_) => confirmMealRemoval(context),
      onDismissed: (_) => onRemove(),
      background: Container(
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.symmetric(horizontal: NhamSpacing.sp5),
        decoration: BoxDecoration(
          color: NhamColors.danger,
          borderRadius: BorderRadius.circular(NhamRadii.containerLg),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              LucideIcons.trash2,
              size: LoggingIcons.size,
              color: Colors.white,
            ),
            const SizedBox(width: 6),
            NhamText(
              'logging.remove'.tr(),
              variant: NhamTextVariant.body,
              style: dashBody(color: Colors.white, weight: FontWeight.w500),
            ),
          ],
        ),
      ),
      child: card,
    );
  }

  /// `P: … C: … F: …` plus alcohol when present — the shared macro line.
  String _macroLine(PersistedMeal meal) {
    final n = meal.nutrition;
    final buffer = StringBuffer(
      'P: ${fmtG(n.proteinG)}  C: ${fmtG(n.carbohydrateG)}  F: ${fmtG(n.fatG)}',
    );
    final alcohol = meal.alcoholG;
    if (alcohol != null && alcohol > 0) {
      buffer.write(
        '  ${'logging.cheatMealCard.alcoholShort'.tr()}: ${fmtG(alcohol)}',
      );
    }
    return buffer.toString();
  }

  @override
  Widget build(BuildContext context) {
    final meal = widget.meal;
    final time = DateFormat.jm(
      context.locale.toString(),
    ).format(DateTime.parse(meal.loggedAt).toLocal());

    // Cheat calories are an estimate the user placed themselves — flag with ≈.
    final kcal = meal.nutrition.caloriesKcal;
    final caloriesApprox = kcal == null ? fmtKcal(kcal) : '≈ ${fmtKcal(kcal)}';

    final curvedExpand = _curvedExpand;

    // No bottom margin — the feed's list separator owns the gap below.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        PersistedMealTimeDivider(time: time),
        const SizedBox(height: LoggingSpacing.block),
        _maybeDismissible(
          Container(
            padding: const EdgeInsets.all(NhamSpacing.sp4),
            decoration: BoxDecoration(
              // Warm accent tint over the card white (web bg-nham-accent/4).
              color: Color.alphaBlend(NhamColors.accent05, NhamColors.elev),
              borderRadius: BorderRadius.circular(NhamRadii.containerLg),
              border: Border.all(color: NhamColors.accent30),
              boxShadow: const [NhamShadows.sm],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: _toggle,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            CheatBadge(
                              label: 'logging.cheatMealCard.badge'.tr(),
                            ),
                            const SizedBox(height: NhamSpacing.sp2),
                            NhamText(
                              meal.rawInput,
                              variant: NhamTextVariant.mealQuote,
                              style: const TextStyle(
                                fontSize: 17,
                                height: 28 / 17,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: NhamSpacing.sp3),
                      _ChevronToggle(expand: _expand, onTap: _toggle),
                    ],
                  ),
                ),

                // Collapsed summary — fades + collapses height as it expands.
                AnimatedBuilder(
                  animation: curvedExpand,
                  builder: (context, child) {
                    final t = curvedExpand.value;
                    final fade = (1 - (t / 0.75)).clamp(0.0, 1.0);
                    return ClipRect(
                      child: Align(
                        heightFactor: (1 - t),
                        child: Opacity(opacity: fade, child: child),
                      ),
                    );
                  },
                  child: Padding(
                    padding: const EdgeInsets.only(top: NhamSpacing.sp2),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Flexible(
                          child: NhamText(
                            _macroLine(meal),
                            variant: NhamTextVariant.captionTabular,
                          ),
                        ),
                        const SizedBox(width: NhamSpacing.sp3),
                        NhamText(
                          caloriesApprox,
                          variant: NhamTextVariant.numStrong,
                          style: dashValue(),
                        ),
                      ],
                    ),
                  ),
                ),

                // Expanded details — the "you set" recap + total + reassurance.
                SizeTransition(
                  sizeFactor: curvedExpand,
                  alignment: Alignment.topCenter,
                  child: FadeTransition(
                    opacity: curvedExpand,
                    child: CheatMealExpandedDetails(
                      meal: meal,
                      macroLine: _macroLine(meal),
                      caloriesApprox: caloriesApprox,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        if (widget.onRemove != null) ...[
          const SizedBox(height: LoggingSpacing.actions),
          Align(
            alignment: Alignment.centerRight,
            child: MealActionIconButton(
              icon: LucideIcons.trash2,
              label: 'logging.remove'.tr(),
              danger: true,
              onTap: () async {
                if (await confirmMealRemoval(context)) {
                  if (!context.mounted) return;
                  widget.onRemove?.call();
                }
              },
            ),
          ),
        ],
      ],
    );
  }
}

/// The collapse chevron — rotates 0°↔180° over 200ms (same as the precise card).
class _ChevronToggle extends StatefulWidget {
  const _ChevronToggle({required this.expand, required this.onTap});

  final Animation<double> expand;
  final VoidCallback onTap;

  @override
  State<_ChevronToggle> createState() => _ChevronToggleState();
}

class _ChevronToggleState extends State<_ChevronToggle> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'logging.cheatMealCard.toggleDetails'.tr(),
      child: GestureDetector(
        // Full [LoggingIcons.hit] tap target around a wash that stays hugging
        // the glyph — bigger target, same small press affordance.
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        onTap: widget.onTap,
        child: SizedBox.square(
          dimension: LoggingIcons.hit,
          child: Center(
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: _pressed ? NhamColors.hover40 : Colors.transparent,
                shape: BoxShape.circle,
              ),
              child: RotationTransition(
                turns: Tween<double>(begin: 0, end: 0.5).animate(widget.expand),
                child: const Icon(
                  LucideIcons.chevronDown,
                  // Same glyph size/ink as the action icons beneath the card.
                  size: LoggingIcons.size,
                  color: NhamColors.text,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
