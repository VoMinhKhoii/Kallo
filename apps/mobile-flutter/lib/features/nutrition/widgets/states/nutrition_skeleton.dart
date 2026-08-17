import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/widgets/feedback/skeleton.dart';
import '../../../../theme/kallo_colors.dart';

/// Single-column loading skeleton mirroring the mobile editorial stack.
/// RN port of `apps/mobile/src/components/nutrition/states/nutrition-skeleton.tsx`.
class NutritionSkeleton extends StatelessWidget {
  const NutritionSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: tr('nutrition.loading'),
      child: SkeletonPulse(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Editorial header.
            Container(
              padding: const EdgeInsets.only(bottom: 20),
              decoration: const BoxDecoration(
                border: Border(
                  bottom: BorderSide(color: KalloColors.borderHalf),
                ),
              ),
              child: const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SkeletonBar(width: 128, height: 12, radius: 9999),
                  SizedBox(height: 8),
                  SkeletonBar(width: 176, height: 12, radius: 9999),
                ],
              ),
            ),
            const SizedBox(height: 48),

            // Daily rhythm card.
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: KalloColors.borderSoft),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      SkeletonBar(width: 128, height: 40, radius: 9999),
                      SkeletonBar(width: 120, height: 8, radius: 9999),
                    ],
                  ),
                  const SizedBox(height: 20),
                  for (var i = 0; i < 4; i++) ...[
                    if (i > 0) const SizedBox(height: 12),
                    const Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        SkeletonBar(width: 64, height: 12, radius: 9999),
                        SizedBox(width: 12),
                        Expanded(child: SkeletonBar(height: 4, radius: 9999)),
                        SizedBox(width: 12),
                        SkeletonBar(width: 44, height: 12, radius: 9999),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 48),

            // Steady list.
            ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: KalloColors.borderHalf),
                ),
                child: Column(
                  children: [
                    for (var i = 0; i < 5; i++)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 12,
                        ),
                        decoration: const BoxDecoration(
                          border: Border(
                            bottom: BorderSide(color: KalloColors.borderFaint),
                          ),
                        ),
                        child: const Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            SkeletonCircle(size: 6),
                            SizedBox(width: 12),
                            Expanded(
                              child: SkeletonBar(height: 12, radius: 9999),
                            ),
                            SizedBox(width: 12),
                            SkeletonBar(width: 44, height: 12, radius: 9999),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 48),

            // Background toggle.
            const Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                SkeletonBar(width: 128, height: 12, radius: 9999),
                SkeletonBar(width: 80, height: 12, radius: 9999),
              ],
            ),
            const SizedBox(height: 48),

            // Pull-quote.
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(width: 3, color: KalloColors.accent30),
                  const SizedBox(width: 20),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SkeletonBar(width: 96, height: 12, radius: 9999),
                        SizedBox(height: 8),
                        SkeletonBar(height: 12, radius: 9999),
                        SizedBox(height: 8),
                        SkeletonBar(widthFactor: 0.8, height: 12, radius: 9999),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
