import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../shared/widgets/nham_text.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../data/logging_models.dart';
import '../logic/format.dart';
import 'dashed_divider.dart';
import 'timeline_rail.dart';

/// A saved meal in the day's feed — collapsed by default, expandable.
///
/// Ported 1:1 from
/// `apps/mobile/src/components/logging/feed/persisted-meal-card.tsx`: the
/// chevron rotates 0°↔180° (200ms), the collapsed summary cross-fades out, and
/// the detail block animates its height open/closed (200ms).
class PersistedMealCard extends StatefulWidget {
  const PersistedMealCard({
    super.key,
    required this.meal,
    this.isLast = false,
    this.onRemove,
  });

  final PersistedMeal meal;
  final bool isLast;

  /// iOS trailing-swipe removal (terracotta, never red) — fired when the card is
  /// dismissed. Null disables the swipe.
  final VoidCallback? onRemove;

  @override
  State<PersistedMealCard> createState() => _PersistedMealCardState();
}

class _PersistedMealCardState extends State<PersistedMealCard>
    with SingleTickerProviderStateMixin {
  bool _collapsed = true;

  // expandProgress 0 (collapsed) → 1 (expanded), 200ms.
  late final AnimationController _expand = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 200),
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
    _expand.dispose();
    super.dispose();
  }

  /// Wrap the card in a trailing-swipe-to-remove Dismissible (terracotta, never
  /// red) when [onRemove] is set; otherwise return the card untouched.
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
            const Icon(Icons.delete_outline, size: 18, color: Colors.white),
            const SizedBox(width: 6),
            NhamText(
              'logging.remove'.tr(),
              variant: NhamTextVariant.body,
              style: NhamTextStyles.sansMedium(fontSize: NhamFontSize.xs)
                  .copyWith(color: Colors.white),
            ),
          ],
        ),
      ),
      child: card,
    );
  }

  @override
  Widget build(BuildContext context) {
    final meal = widget.meal;
    final n = meal.nutrition;
    final time = DateFormat.jm(context.locale.toString())
        .format(DateTime.parse(meal.loggedAt).toLocal());

    // Details height open/close: 200ms ease-in-out (persisted-meal-card.tsx:231).
    final curvedExpand = CurvedAnimation(
      parent: _expand,
      curve: Curves.easeInOut,
    );

    return TimelineRail(
      isLast: widget.isLast,
      child: Padding(
        padding: const EdgeInsets.only(bottom: NhamSpacing.sp3), // mb-3
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Time label sits ABOVE the card (sibling, mb-2) — not inside it.
            NhamText(
              time,
              variant: NhamTextVariant.timeLabel,
            ),
            const SizedBox(height: NhamSpacing.sp2), // mb-2
            _maybeDismissible(
            _Card(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header — the whole row is the toggle target (not just the
                  // ~24px chevron), so the comfortable tap area spans the quote.
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: _toggle,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: NhamText(
                            meal.rawInput,
                            variant: NhamTextVariant.mealQuote,
                            style: const TextStyle(
                              fontSize: 17,
                              height: 28 / 17, // leading-7 (28px)
                            ),
                          ),
                        ),
                        const SizedBox(width: NhamSpacing.sp3), // gap-3
                        _ChevronToggle(
                          expand: _expand,
                          onTap: _toggle,
                        ),
                      ],
                    ),
                  ),

                  // Collapsed summary — fades + collapses height as it expands.
                  AnimatedBuilder(
                    animation: curvedExpand,
                    builder: (context, child) {
                      final t = curvedExpand.value;
                      // Summary cross-fade runs at 150ms (faster than the
                      // 200ms height) — fade out within the first 0.75 of the
                      // open progress.
                      final fade = (1 - (t / 0.75)).clamp(0.0, 1.0);
                      return ClipRect(
                        child: Align(
                          heightFactor: (1 - t),
                          child: Opacity(opacity: fade, child: child),
                        ),
                      );
                    },
                    child: Padding(
                      padding:
                          const EdgeInsets.only(top: NhamSpacing.sp2), // mt-2
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          NhamText(
                            'P: ${fmtG(n.proteinG)}  C: ${fmtG(n.carbohydrateG)}  F: ${fmtG(n.fatG)}',
                            variant: NhamTextVariant.captionTabular,
                          ),
                          NhamText(
                            fmtKcal(n.caloriesKcal),
                            variant: NhamTextVariant.numStrong,
                            style: const TextStyle(fontSize: 14), // text-sm
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Expanded details — animate height open (easeInOut).
                  SizeTransition(
                    sizeFactor: curvedExpand,
                    alignment: Alignment.topCenter,
                    child: FadeTransition(
                      opacity: curvedExpand,
                      child: _ExpandedDetails(meal: meal),
                    ),
                  ),
                ],
              ),
            ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The collapse chevron: its OWN button — rounded-full p-1, text-muted/60,
/// pressed bg-nham-hover/40 + text-nham-text (web hover affordance). Rotates
/// 0°↔180° over 200ms.
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
    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150), // transition-colors
        padding: const EdgeInsets.all(4), // p-1
        decoration: BoxDecoration(
          color: _pressed ? NhamColors.hover40 : Colors.transparent,
          shape: BoxShape.circle,
        ),
        child: RotationTransition(
          turns: Tween<double>(begin: 0, end: 0.5).animate(widget.expand),
          child: Icon(
            Icons.keyboard_arrow_down, // lucide ChevronDown
            size: 16,
            color: _pressed ? NhamColors.text : NhamColors.textMuted60,
          ),
        ),
      ),
    );
  }
}

class _ExpandedDetails extends StatelessWidget {
  const _ExpandedDetails({required this.meal});
  final PersistedMeal meal;

  @override
  Widget build(BuildContext context) {
    final n = meal.nutrition;
    final groups = [...meal.mealItemGroups]
      ..sort((a, b) => a.order.compareTo(b.order));
    return Padding(
      padding: const EdgeInsets.only(top: NhamSpacing.sp5), // mt-5
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const DashedDivider(color: NhamColors.border),
          const SizedBox(height: NhamSpacing.sp4), // pt-4
          Padding(
            padding: const EdgeInsets.only(bottom: NhamSpacing.sp4), // mb-4
            child: Column(
              children: [
                for (final group in groups)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8), // py-2
                    child: Row(
                      children: [
                        Expanded(
                          child: NhamText(
                            group.name,
                            variant: NhamTextVariant.itemName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: NhamSpacing.sp3), // gap-3
                        Row(
                          children: [
                            NhamText('P:${fmtG(group.nutrition.proteinG)}',
                                variant: NhamTextVariant.macroTiny),
                            const SizedBox(width: NhamSpacing.sp2),
                            NhamText('C:${fmtG(group.nutrition.carbohydrateG)}',
                                variant: NhamTextVariant.macroTiny),
                            const SizedBox(width: NhamSpacing.sp2),
                            NhamText('F:${fmtG(group.nutrition.fatG)}',
                                variant: NhamTextVariant.macroTiny),
                            const SizedBox(width: NhamSpacing.sp3), // gap-3
                            NhamText(
                              fmtKcal(group.nutrition.caloriesKcal),
                              variant: NhamTextVariant.calorieBold,
                            ),
                          ],
                        ),
                      ],
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
              NhamText('logging.persistedMealCard.total'.tr(),
                  variant: NhamTextVariant.calorieBold),
              Row(
                children: [
                  NhamText(
                    'P: ${fmtG(n.proteinG)}  C: ${fmtG(n.carbohydrateG)}  F: ${fmtG(n.fatG)}',
                    variant: NhamTextVariant.captionTabular,
                  ),
                  const SizedBox(width: NhamSpacing.sp4), // gap-4
                  NhamText(fmtKcal(n.caloriesKcal),
                      variant: NhamTextVariant.numStrong),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Card: rounded-2xl (16px), border/60 hairline, shadow.sm, padding 16.
class _Card extends StatelessWidget {
  const _Card({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(NhamSpacing.sp4),
      decoration: BoxDecoration(
        color: NhamColors.elev,
        borderRadius: BorderRadius.circular(NhamRadii.containerLg),
        border: Border.all(color: NhamColors.borderSoft),
        boxShadow: const [NhamShadows.sm],
      ),
      child: child,
    );
  }
}
