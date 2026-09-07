import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/nutrition/nutrition.dart';
import '../../../../shared/logic/display_format.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/helpers.dart';
import '../../logic/nutrient_display.dart';
import 'nutrient_bar.dart';

/// One nutrient as its own card in the 2-column grid.
///
/// **Why cards again (2026-09-07).** The native pass replaced a grid like this
/// with rows, arguing that twenty cards read as twenty objects to decide
/// about. That was right about a grid whose cells all looked alike — and it is
/// what this card fixes rather than repeats: a nutrient that has MET its
/// target fills green, so the page answers "what still needs attention" by
/// colour before anything is read. Twenty rows are only scannable if you read
/// twenty figures. Web has been on this grid since its nutrition rewrite
/// (`components/nutrition/rows/nutrient-grid-card.tsx`); this restores parity
/// with it rather than inventing a third layout.
///
/// The figure is a PERCENTAGE here, where the row put the absolute reading on
/// its title line. Both appear — percent as the headline, avg/target
/// underneath — because in a grid the percentage is the thing being compared
/// across cells, and the absolute is the thing being checked once.
class NutrientGridCard extends StatelessWidget {
  const NutrientGridCard({
    super.key,
    required this.card,
    this.barDelay = Duration.zero,
  });

  final NutrientCardData card;

  /// Staggers the fill so a grid arrives in sequence rather than all at once.
  final Duration barDelay;

  @override
  Widget build(BuildContext context) {
    final label = tr(card.labelKey);
    final pct = card.percentOfTarget;
    final limited = isLowConfidence(card.displayState);
    final exceeded = shouldShowExceed(card.nutrientType, pct);
    final adequate = nutrientIsAdequate(card);

    final figure = nutrientFigure(
      card,
      limitedLabel: tr('nutrition.steady.limited'),
      noTargetLabel: tr('nutrition.steady.noTarget'),
      percentLabel: (value) =>
          tr('nutrition.steady.percent', namedArgs: {'value': '$value'}),
    );
    final goal = nutrientGoalText(card, localeOf(context));

    return Semantics(
      label: '$label, $figure, $goal',
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.all(KalloSpacing.sp3),
        decoration: BoxDecoration(
          // The green is the whole point of the grid: a met nutrient is a
          // filled card, readable without reading. Everything else keeps the
          // app's ordinary card surface and its one hairline.
          color: adequate ? KalloColors.successFaint : kCardSurface,
          borderRadius: BorderRadius.circular(KalloRadii.containerLg),
          border: Border.all(
            color: adequate ? KalloColors.successBorder : kHairline,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Expanded(
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    // Caption, and justified here as the tier requires: a cell
                    // is half the screen less its gutters (~147pt of text on a
                    // 390pt phone), and "Pantothenic acid" beside its figure
                    // measures past that at Meta — the label ellipsed away the
                    // part that identifies it.
                    style: dashCaption(color: kInk),
                  ),
                ),
                const SizedBox(width: KalloSpacing.sp2),
                Text(
                  figure,
                  style: dashCaption(
                    color: exceeded
                        ? KalloColors.danger
                        : (limited || pct == null)
                        ? kInkMuted
                        : adequate
                        ? KalloColors.successDark
                        : kInk,
                    tabular: true,
                  ),
                ),
              ],
            ),
            const SizedBox(height: KalloSpacing.sp2),
            NutrientBar(
              percentOfTarget: pct,
              color: nutrientFillColor(card),
              delay: barDelay,
            ),
            const SizedBox(height: KalloSpacing.sp2),
            Text(
              goal,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: dashCaption(tabular: true),
            ),
          ],
        ),
      ),
    );
  }
}
