import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../models/cheat.dart';
import '../../../shared/widgets/nham_text.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../data/logging_models.dart';
import '../logic/format.dart';
import '../logic/slider_nutrition.dart';
import 'cheat_slider_card.dart' show CheatBadge, cheatSliderColor;

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

  /// Trailing-swipe removal (terracotta, never red) — fired when the card is
  /// dismissed. Null disables the swipe.
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
      onDismissed: (_) {
        HapticFeedback.mediumImpact();
        onRemove();
      },
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
            const Icon(LucideIcons.trash2, size: 18, color: Colors.white),
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

    return Padding(
      padding: const EdgeInsets.only(bottom: NhamSpacing.sp3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _TimeDivider(time: time),
          const SizedBox(height: NhamSpacing.sp2),
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
                      child: _ExpandedDetails(
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
        ],
      ),
    );
  }
}

class _ExpandedDetails extends StatelessWidget {
  const _ExpandedDetails({
    required this.meal,
    required this.macroLine,
    required this.caloriesApprox,
  });

  final PersistedMeal meal;
  final String macroLine;
  final String caloriesApprox;

  @override
  Widget build(BuildContext context) {
    final persisted = meal.cheatSliders;
    return Padding(
      padding: const EdgeInsets.only(top: NhamSpacing.sp5),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Divider(height: 1, thickness: 1, color: NhamColors.borderFaint),
          const SizedBox(height: NhamSpacing.sp4),
          if (persisted != null) ...[
            Text(
              'logging.cheatMealCard.youSet'.tr(),
              style: dashEyebrow(),
            ),
            const SizedBox(height: NhamSpacing.sp2),
            for (final slider in persisted.spec.sliders)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: _YouSetRow(
                  slider: slider,
                  level:
                      persisted.levels[slider.key] ?? slider.defaultLevel,
                ),
              ),
            const SizedBox(height: NhamSpacing.sp3),
            const Divider(
              height: 1,
              thickness: 1,
              color: NhamColors.borderFaint,
            ),
            const SizedBox(height: NhamSpacing.sp3),
          ],
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              NhamText(
                'logging.cheatMealCard.total'.tr(),
                variant: NhamTextVariant.calorieBold,
              ),
              Flexible(
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Flexible(
                      child: NhamText(
                        macroLine,
                        variant: NhamTextVariant.captionTabular,
                      ),
                    ),
                    const SizedBox(width: NhamSpacing.sp4),
                    NhamText(
                      caloriesApprox,
                      variant: NhamTextVariant.numStrong,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: NhamSpacing.sp4),
          NhamText(
            'logging.cheatMealCard.reassurance'.tr(),
            variant: NhamTextVariant.small,
            style: dashMeta().copyWith(fontStyle: FontStyle.italic),
          ),
        ],
      ),
    );
  }
}

/// One slider recap row: label, the six-dot stop scale, the anchor scenario.
class _YouSetRow extends StatelessWidget {
  const _YouSetRow({required this.slider, required this.level});

  final CheatSlider slider;
  final double level;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        NhamText(
          slider.label,
          variant: NhamTextVariant.body,
          style: dashBody(weight: FontWeight.w500).copyWith(fontSize: 13),
        ),
        const SizedBox(width: NhamSpacing.sp2),
        _StopScale(level: level, color: cheatSliderColor(slider.key)),
        const SizedBox(width: NhamSpacing.sp3),
        Expanded(
          child: NhamText(
            activeAnchorLabel(slider, level),
            variant: NhamTextVariant.small,
            textAlign: TextAlign.right,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: dashMeta(),
          ),
        ),
      ],
    );
  }
}

/// Six dots filled up to the chosen stop — where on the scale the user landed.
class _StopScale extends StatelessWidget {
  const _StopScale({required this.level, required this.color});

  final double level;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final filled = ((level / 2).round() + 1).clamp(1, 6);
    return ExcludeSemantics(
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < 6; i++)
            Padding(
              padding: EdgeInsets.only(left: i == 0 ? 0 : 2),
              child: Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: i < filled ? color : Colors.transparent,
                  shape: BoxShape.circle,
                  border:
                      i < filled
                          ? null
                          : Border.all(color: NhamColors.border),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Centered time divider on top of the card (── 1:04 AM ──), matching the
/// precise persisted card's.
class _TimeDivider extends StatelessWidget {
  const _TimeDivider({required this.time});

  final String time;

  @override
  Widget build(BuildContext context) {
    const line = Expanded(
      child: Divider(color: NhamColors.borderFaint, height: 1, thickness: 1),
    );
    return Row(
      children: [
        line,
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: NhamSpacing.sp3),
          child: NhamText(time, variant: NhamTextVariant.timeLabel),
        ),
        line,
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
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: _pressed ? NhamColors.hover40 : Colors.transparent,
            shape: BoxShape.circle,
          ),
          child: RotationTransition(
            turns: Tween<double>(begin: 0, end: 0.5).animate(widget.expand),
            child: Icon(
              LucideIcons.chevronDown,
              size: 16,
              color: _pressed ? NhamColors.text : NhamColors.textMuted60,
            ),
          ),
        ),
      ),
    );
  }
}
