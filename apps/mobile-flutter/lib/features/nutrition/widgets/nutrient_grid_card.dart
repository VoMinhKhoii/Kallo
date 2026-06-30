import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../features/dashboard/widgets/dashboard_tokens.dart';
import '../../../models/nutrition.dart';
import '../../../shared/widgets/target_progress_bar.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../logic/helpers.dart';
import '../logic/status.dart';

/// A compact nutrient cell for the 2-column grid: name + % on top, an inline
/// progress bar below. When the nutrient is adequate (a met floor / an in-limit
/// ceiling) the whole card greens to signal success; everything else stays
/// neutral, and limited / no-target nutrients read muted.
class NutrientGridCard extends StatelessWidget {
  const NutrientGridCard({super.key, required this.card, this.barDelay});

  final NutrientCardData card;

  /// Optional stagger so a row of bars fills in sequence.
  final Duration? barDelay;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.languageCode;
    final label = tr(card.labelKey);
    final pct = card.percentOfTarget;
    final isLimited =
        card.displayState == ConfidenceDisplayState.limitedData ||
        card.displayState == ConfidenceDisplayState.insufficientData;
    final showExceed = shouldShowExceed(card.nutrientType, pct);

    // Success = a real, confident reading that's on target (floor met, or a
    // ceiling held under its limit). An exceeded ceiling is never "success".
    final adequate = pct != null &&
        !isLimited &&
        !showExceed &&
        statusKeyFor(card) == StatusKey.onTarget;

    String figure;
    if (card.displayState == ConfidenceDisplayState.insufficientData) {
      figure = tr('nutrition.cell.limited');
    } else if (pct == null) {
      figure = tr('nutrition.cell.noTarget');
    } else if (showExceed && pct > 100) {
      figure = '+${(pct - 100).round()}%';
    } else {
      figure = tr(
        'nutrition.steady.percent',
        namedArgs: {'value': pct.round().toString()},
      );
    }

    final Color figureColor = showExceed
        ? NhamColors.danger
        : isLimited || pct == null
            ? kInkDisabled
            : adequate
                ? NhamColors.successDark
                : kInk;

    // Absolute average / goal in the nutrient's own unit (g or mg/mcg).
    final String goalText;
    if (card.target != null) {
      final avgStr = card.averagePerDay != null
          ? formatLocalizedNumber(card.averagePerDay!, locale)
          : '0';
      goalText =
          '$avgStr / ${formatLocalizedNumber(card.target!, locale)} ${card.unit}';
    } else if (card.averagePerDay != null) {
      goalText = '${formatLocalizedNumber(card.averagePerDay!, locale)} ${card.unit}';
    } else {
      goalText = '—';
    }

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: NhamSpacing.sp3,
        vertical: NhamSpacing.sp3,
      ),
      decoration: BoxDecoration(
        color: adequate ? NhamColors.successFaint : kCardSurface,
        borderRadius: BorderRadius.circular(NhamRadii.containerLg),
        border: Border.all(
          color: adequate ? NhamColors.successBorder : NhamColors.borderSoft,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
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
                  style: dashMeta(color: kInk),
                ),
              ),
              const SizedBox(width: NhamSpacing.sp2),
              Text(
                figure,
                style: dashMeta(color: figureColor, tabular: true),
              ),
            ],
          ),
          const SizedBox(height: NhamSpacing.sp2),
          TargetProgressBar(
            percentOfTarget: pct,
            showExceed: showExceed,
            delay: barDelay ?? Duration.zero,
            semanticLabel: label,
            fillColor: adequate ? NhamColors.successAccent : null,
          ),
          const SizedBox(height: NhamSpacing.sp2),
          Text(
            goalText,
            maxLines: 1,
            overflow: TextOverflow.clip,
            style: NhamTextStyles.sansRegular(fontSize: NhamFontSize.xxs).copyWith(
              color: kInkDisabled,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}
