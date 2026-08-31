import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../logic/macro_composition.dart';
import 'composition_bar.dart';

/// Where the kcal figure sits in a [MealBlock].
///
/// Own meals (Recent meals, the logging feed card) put kcal 14/500 at the
/// TITLE row's right or the LEGEND's right; Circle posts lead the legend
/// with it. One anatomy, two documented placements.
enum MealBlockKcal { titleRight, legendLeading, legendTrailing }

/// The shared meal-block anatomy (native pass, 2026-08-31):
/// meal text 14 → 6px calorie-share bar → legend row with 14px macro food
/// glyphs + 12 muted gram labels. Used by Recent meals, the logging feed
/// card and Circle posts — same bones, different kcal placement.
class MealBlock extends StatelessWidget {
  const MealBlock({
    super.key,
    required this.title,
    required this.segments,
    required this.gramLabels,
    this.kcalLabel,
    this.kcalPlacement = MealBlockKcal.titleRight,
    this.titleMaxLines = 2,
    this.titleTrailing,
  });

  /// The meal text — 14pt regular ink (no serif; the greeting is the app's
  /// only serif moment).
  final String title;

  /// Calorie-share segments for the 6px compact bar (sum to 1).
  final List<CompositionSegment> segments;

  /// Gram label per macro key, in [kCompositionKeys] order where present —
  /// e.g. {'protein': 'P 28g', 'carbohydrate': 'C 52g', 'fat': 'F 9g'}.
  final Map<String, String> gramLabels;

  /// "420 kcal" — omit to drop the figure entirely.
  final String? kcalLabel;
  final MealBlockKcal kcalPlacement;

  final int titleMaxLines;

  /// Optional control on the title row (the logging card's collapse chevron).
  final Widget? titleTrailing;

  @override
  Widget build(BuildContext context) {
    final kcal = kcalLabel == null
        ? null
        : Text(kcalLabel!, style: dashBody(weight: FontWeight.w500));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Text(
                title,
                maxLines: titleMaxLines,
                overflow: TextOverflow.ellipsis,
                style: dashBody(),
              ),
            ),
            if (kcalPlacement == MealBlockKcal.titleRight && kcal != null) ...[
              const SizedBox(width: 8),
              kcal,
            ],
            if (titleTrailing != null) titleTrailing!,
          ],
        ),
        const SizedBox(height: 8),
        CompositionBar.compact(segments: segments),
        const SizedBox(height: 6),
        Row(
          // Circle posts spread kcal and the three macros across the full
          // width (the artboard's space-between); own-meal legends cluster.
          mainAxisAlignment:
              kcalPlacement == MealBlockKcal.legendLeading && kcal != null
                  ? MainAxisAlignment.spaceBetween
                  : MainAxisAlignment.start,
          children: [
            if (kcalPlacement == MealBlockKcal.legendLeading &&
                kcal != null)
              kcal,
            for (final key in kCompositionKeys)
              if (gramLabels[key] != null) ...[
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      kMacroIcons[key],
                      size: 14,
                      color: kCompositionColors[key],
                    ),
                    const SizedBox(width: 4),
                    // Caption 13, not Meta 15 (Threads scale, 2026-09-01).
                    // This legend is three icon+figure pairs and a kcal total
                    // on ONE line: at Meta 15 it measures 253.4pt of legend
                    // plus a 73.9pt kcal, which does not fit a 320pt phone's
                    // card. The tier exists for exactly this — a compact
                    // component the secondary size visibly breaks.
                    Text(gramLabels[key]!, style: dashCaption()),
                  ],
                ),
                if (key != kCompositionKeys.last &&
                    kcalPlacement != MealBlockKcal.legendLeading)
                  const SizedBox(width: 14),
              ],
            if (kcalPlacement == MealBlockKcal.legendTrailing &&
                kcal != null) ...[
              const Spacer(),
              kcal,
            ],
          ],
        ),
      ],
    );
  }
}
