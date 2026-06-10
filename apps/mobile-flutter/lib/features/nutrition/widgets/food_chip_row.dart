import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/nutrition.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_typography.dart';
import '../logic/candidate_nutrients.dart';
import '../providers/food_candidates_provider.dart';

/// Spotlight (warmer) vs steady chip treatment.
enum FoodChipVariant { spotlight, steady }

/// RN port of `apps/mobile/src/components/nutrition/rows/food-chip-row.tsx`.
class FoodChipRow extends ConsumerWidget {
  const FoodChipRow({
    super.key,
    required this.nutrient,
    this.enabled = true,
    this.variant = FoodChipVariant.spotlight,
    this.limit = 5,
  });

  final NutritionNutrientKey nutrient;
  final bool enabled;
  final FoodChipVariant variant;
  final int limit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final supported = asSupported(nutrient);
    if (supported == null) return const SizedBox.shrink();

    if (!enabled) return const SizedBox.shrink();

    final async = ref.watch(foodCandidatesProvider(nutrient));

    return async.when(
      loading: () => _ChipRowSkeleton(variant: variant),
      error: (_, __) => Text(
        tr('nutrition.errors.candidatesError'),
        style: NhamTextStyles.sansRegular(fontSize: 12)
            .copyWith(color: NhamColors.textMuted),
      ),
      data: (response) {
        if (response == null) return const SizedBox.shrink();
        if (response.candidates.isEmpty) {
          return Text(
            tr('nutrition.focus.noFoodIdeas'),
            style: NhamTextStyles.sansRegular(fontSize: 12)
                .copyWith(color: NhamColors.textMuted),
          );
        }

        final chips = response.candidates.take(limit).toList();
        final isSpotlight = variant == FoodChipVariant.spotlight;

        return Wrap(
          spacing: 6,
          runSpacing: 6,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(
              tr('nutrition.focus.tryLabel').toUpperCase(),
              style: NhamTextStyles.sansBold(fontSize: 10).copyWith(
                letterSpacing: 2,
                color: NhamColors.stone,
              ),
            ),
            for (final candidate in chips)
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(9999),
                  border: Border.all(
                    color: isSpotlight
                        ? NhamColors.accent40
                        : NhamColors.borderSoft,
                  ),
                  color: isSpotlight
                      ? NhamColors.accent10
                      : NhamColors.cardWhite40,
                ),
                child: Text(
                  tr(candidate.nameKey),
                  style: NhamTextStyles.sansRegular(fontSize: 11).copyWith(
                    height: 20 / 11,
                    color: variant == FoodChipVariant.steady
                        ? NhamColors.textMuted
                        : NhamColors.text,
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _ChipRowSkeleton extends StatelessWidget {
  const _ChipRowSkeleton({required this.variant});

  final FoodChipVariant variant;

  @override
  Widget build(BuildContext context) {
    const widths = [60.0, 80.0, 70.0, 90.0];
    final fill = variant == FoodChipVariant.spotlight
        ? NhamColors.accent15
        : NhamColors.track;
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        for (final w in widths)
          Container(
            width: w,
            height: 28,
            decoration: BoxDecoration(
              color: fill,
              borderRadius: BorderRadius.circular(9999),
            ),
          ),
      ],
    );
  }
}
