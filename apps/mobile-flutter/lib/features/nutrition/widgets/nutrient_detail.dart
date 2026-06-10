import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../models/nutrition.dart';
import '../../../shared/widgets/target_progress_bar.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_typography.dart';
import '../logic/helpers.dart';
import '../logic/status.dart';
import 'food_chip_row.dart';

/// RN port of `apps/mobile/src/components/nutrition/rows/nutrient-detail.tsx`.
class NutrientDetail extends StatelessWidget {
  const NutrientDetail({super.key, required this.card});

  final NutrientCardData card;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.languageCode;
    final label = tr(card.labelKey);

    final hasTarget = card.percentOfTarget != null;
    final percent = card.percentOfTarget ?? 0;
    final showExceed = shouldShowExceed(card.nutrientType, card.percentOfTarget);

    final avgText = card.averagePerDay == null
        ? null
        : tr('nutrition.focus.averageLine', namedArgs: {
            'value': formatLocalizedNumber(card.averagePerDay!, locale),
            'unit': card.unit,
            'source': tr(card.targetSourceLabelKey),
          });

    final avgStyle = NhamTextStyles.sansMedium(fontSize: 14).copyWith(
      color: NhamColors.text,
      fontFeatures: const [FontFeature.tabularFigures()],
    );

    final children = <Widget>[];

    if (hasTarget) {
      children.add(
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: TargetProgressBar(
                percentOfTarget: card.percentOfTarget,
                showExceed: showExceed,
                duration: const Duration(milliseconds: 550),
                semanticLabel: tr('nutrition.focus.spotlightBarAria',
                    namedArgs: {
                      'label': label,
                      'pct': percent.round().toString(),
                    }),
              ),
            ),
            if (card.target != null) ...[
              const SizedBox(width: 12),
              Text(
                '${formatLocalizedNumber(card.target!, locale)} ${card.unit}',
                style: NhamTextStyles.sansRegular(fontSize: 11).copyWith(
                  color: NhamColors.textMuted,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ],
          ],
        ),
      );
      if (avgText != null) {
        children.add(Text(avgText, style: avgStyle));
      }
    } else if (avgText != null) {
      children.add(Text(avgText, style: avgStyle));
    } else {
      children.add(
        Text(
          tr('nutrition.card.noData'),
          style: NhamTextStyles.sansRegular(fontSize: 14)
              .copyWith(color: NhamColors.textMuted),
        ),
      );
    }

    if (showChips(card)) {
      children.add(
        FoodChipRow(
          nutrient: card.nutrient,
          variant: FoodChipVariant.spotlight,
          limit: 5,
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: _withGap(children, 16),
      ),
    );
  }
}

/// Inserts vertical [gap] between [children] (RN `gap-4` = 16px).
List<Widget> _withGap(List<Widget> children, double gap) {
  if (children.isEmpty) return children;
  final out = <Widget>[];
  for (var i = 0; i < children.length; i++) {
    if (i > 0) out.add(SizedBox(height: gap));
    out.add(children[i]);
  }
  return out;
}
