import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../models/nutrition.dart';
import '../../../shared/widgets/target_progress_bar.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_typography.dart';
import '../logic/helpers.dart';
import 'fade_in_down.dart';
import 'food_chip_row.dart';

/// RN port of `apps/mobile/src/components/nutrition/rows/spotlight-row.tsx`.
class SpotlightRow extends StatelessWidget {
  const SpotlightRow({super.key, required this.card, this.delay = 0});

  final NutrientCardData card;

  /// Entrance delay, ms (mirrors the web per-card motion stagger).
  final int delay;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.languageCode;
    final label = tr(card.labelKey);
    final percent = card.percentOfTarget ?? 0;
    final showExceed = shouldShowExceed(card.nutrientType, card.percentOfTarget);
    final figure = showExceed && percent > 100
        ? '+${(percent - 100).round()}%'
        : tr('nutrition.focus.percentOfTarget',
            namedArgs: {'value': percent.round().toString()});

    return FadeInDown(
      duration: const Duration(milliseconds: 500),
      delay: Duration(milliseconds: delay),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Title + % figure row.
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Flexible(
                child: Text(
                  label,
                  style: NhamTextStyles.serifMedium(fontSize: 21).copyWith(
                    height: 27 / 21,
                    letterSpacing: -0.21,
                    color: NhamColors.text,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Text(
                figure,
                style: NhamTextStyles.sansMedium(fontSize: 14).copyWith(
                  color: showExceed ? NhamColors.danger : NhamColors.text,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Bar + target row.
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: TargetProgressBar(
                  percentOfTarget: card.percentOfTarget,
                  showExceed: showExceed,
                  delay: Duration(milliseconds: delay + 100),
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
          const SizedBox(height: 12),
          // Average line.
          Text(
            tr('nutrition.focus.averageLine', namedArgs: {
              'value': card.averagePerDay == null
                  ? '—'
                  : formatLocalizedNumber(card.averagePerDay!, locale),
              'unit': card.unit,
              'source': tr(card.targetSourceLabelKey),
            }),
            style: NhamTextStyles.sansMedium(fontSize: 14).copyWith(
              color: NhamColors.text,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
          const SizedBox(height: 12),
          FoodChipRow(
            nutrient: card.nutrient,
            variant: FoodChipVariant.spotlight,
            limit: 5,
          ),
        ],
      ),
    );
  }
}
