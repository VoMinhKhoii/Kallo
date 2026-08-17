import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../models/nutrition/nutrition.dart';
import '../../../../shared/widgets/feedback/target_progress_bar.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/helpers.dart';
import '../../logic/status.dart';

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
    final isLimited = isLowConfidence(card.displayState);
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
        ? KalloColors.offTarget
        : isLimited || pct == null
            ? kInkMuted
            : adequate
                ? KalloColors.successDark
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
        horizontal: KalloSpacing.sp3,
        vertical: KalloSpacing.sp3,
      ),
      decoration: BoxDecoration(
        color: adequate ? KalloColors.successFaint : kCardSurface,
        borderRadius: BorderRadius.circular(KalloRadii.containerLg),
        border: Border.all(
          color: adequate ? KalloColors.successBorder : KalloColors.borderSoft,
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
              const SizedBox(width: KalloSpacing.sp2),
              Text(
                figure,
                style: dashMeta(color: figureColor, tabular: true),
              ),
            ],
          ),
          const SizedBox(height: KalloSpacing.sp2),
          TargetProgressBar(
            percentOfTarget: pct,
            showExceed: showExceed,
            delay: barDelay ?? Duration.zero,
            semanticLabel: label,
            fillColor: adequate ? KalloColors.successAccent : null,
          ),
          const SizedBox(height: KalloSpacing.sp2),
          Text(
            goalText,
            maxLines: 1,
            overflow: TextOverflow.clip,
            style: dashMeta(color: kInkMuted, tabular: true),
          ),
        ],
      ),
    );
  }
}
