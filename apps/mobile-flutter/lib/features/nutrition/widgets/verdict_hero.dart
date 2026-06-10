import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../models/nutrition.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_typography.dart';
import '../logic/verdict_logic.dart';
import 'fade_in_down.dart';

/// RN port of `apps/mobile/src/components/nutrition/sections/verdict-hero.tsx`.
class VerdictHero extends StatelessWidget {
  const VerdictHero({super.key, required this.overview});

  final NutritionOverview overview;

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.languageCode;
    final dayFormatter = NumberFormat.decimalPattern(locale);

    final period = tr('nutrition.${kPeriodKeys[overview.resolvedRange]}');
    final consistent = joinNames(
      takeNames(overview.summary.mostConsistent, tr),
      locale,
    );
    final attention = joinNames(
      takeNames(overview.summary.needsAttention, tr),
      locale,
    );
    final tooFew = overview.trendStatus == 'too_few_logged_days';

    String headline;
    String muted;

    if (tooFew) {
      headline = tr('nutrition.verdict.gathering');
      muted = tr('nutrition.verdict.gatheringSub', namedArgs: {
        'days': dayFormatter.format(overview.completeDays),
      });
    } else {
      if (consistent.isNotEmpty && attention.isNotEmpty) {
        headline = tr('nutrition.verdict.both', namedArgs: {
          'period': period,
          'consistent': consistent,
          'attention': attention,
        });
      } else if (consistent.isNotEmpty) {
        headline = tr('nutrition.verdict.steadyOnly', namedArgs: {
          'period': period,
          'consistent': consistent,
        });
      } else if (attention.isNotEmpty) {
        headline = tr('nutrition.verdict.attentionOnly', namedArgs: {
          'period': period,
          'attention': attention,
        });
      } else {
        headline = tr('nutrition.verdict.quiet');
      }

      final avgConfidence = getAverageConfidence(overview);
      muted = avgConfidence == null
          ? tr('nutrition.verdict.trustLineNoConfidence', namedArgs: {
              'days': dayFormatter.format(overview.completeDays),
            })
          : tr('nutrition.verdict.trustLine', namedArgs: {
              'days': dayFormatter.format(overview.completeDays),
              'confidence': (NumberFormat.decimalPattern(locale)
                    ..maximumFractionDigits = 0)
                  .format(avgConfidence),
            });
      if (overview.partialDays > 0) {
        // ICU plural → easy_localization plural object. The leading '· ' and the
        // count live inside each form; '{}' is the count.
        final note =
            'nutrition.verdict.partialNote'.plural(overview.partialDays);
        muted += ' $note';
      }
    }

    // Web motion.p: flex flex-wrap items-baseline gap-x-2.5 gap-y-1, leading-6.
    // Web animates y:4→0 (offset 4), duration 0.5, delay 0.05.
    return FadeInDown(
      offset: 4,
      delay: const Duration(milliseconds: 50),
      child: Wrap(
        spacing: 10,
        runSpacing: 4,
        crossAxisAlignment: WrapCrossAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 5),
            child: Container(
              width: 6,
              height: 6,
              decoration: const BoxDecoration(
                color: NhamColors.accent,
                shape: BoxShape.circle,
              ),
            ),
          ),
          Text(
            headline,
            style: NhamTextStyles.serifMedium(fontSize: 14)
                .copyWith(height: 24 / 14, color: NhamColors.text),
          ),
          Text(
            muted,
            style: NhamTextStyles.sansRegular(fontSize: 14)
                .copyWith(height: 24 / 14, color: NhamColors.textMuted),
          ),
        ],
      ),
    );
  }
}
