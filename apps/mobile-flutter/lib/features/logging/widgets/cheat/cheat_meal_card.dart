import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/logging_models.dart';
import '../../logic/format.dart';
import '../../logic/logging_spacing.dart';
import 'cheat_meal_expanded_details.dart';
import 'cheat_slider_card.dart' show CheatBadge;
import '../actions/confirm_meal_removal.dart';
import '../actions/swipe_to_remove.dart';
import '../turn/turn_header.dart';
import '../actions/meal_action_icon_button.dart';

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

  /// Removal (destructive red) — fired by the trailing swipe or the
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
        TurnHeader(time: time, message: meal.rawInput),
        SwipeToRemove(
          mealId: meal.id,
          onRemove: widget.onRemove,
          builder:
              (context, radius) => Container(
                padding: LoggingSpacing.card,
                decoration: BoxDecoration(
                  // Warm accent tint over the card white (web bg-kallo-accent/4).
                  color: Color.alphaBlend(
                    KalloColors.accent05,
                    KalloColors.elev,
                  ),
                  borderRadius: radius,
                  border: Border.all(color: KalloColors.accent30),
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
                                const SizedBox(height: KalloSpacing.sp2),
                                // Plain 14, not the Lora quote: the greeting
                                // is the app's one serif moment again.
                                Text(meal.rawInput, style: dashBody()),
                              ],
                            ),
                          ),
                          const SizedBox(width: KalloSpacing.sp3),
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
                        padding: const EdgeInsets.only(top: KalloSpacing.sp2),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Flexible(
                              child: Text(
                                _macroLine(meal),
                                style: dashMeta(tabular: true),
                              ),
                            ),
                            const SizedBox(width: KalloSpacing.sp3),
                            Text(caloriesApprox, style: dashValue()),
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
              icon: LucideIcons.trash2300,
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
          // Right-aligned so the glyph lands on the content edge; the 36pt
          // target keeps its size by extending inward.
          child: Align(
            alignment: Alignment.centerRight,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: _pressed ? KalloColors.hover40 : Colors.transparent,
                shape: BoxShape.circle,
              ),
              child: RotationTransition(
                turns: Tween<double>(begin: 0, end: 0.5).animate(widget.expand),
                child: const Icon(
                  LucideIcons.chevronDown300,
                  // Same glyph size/ink as the action icons beneath the card.
                  size: LoggingIcons.size,
                  color: KalloColors.text,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
