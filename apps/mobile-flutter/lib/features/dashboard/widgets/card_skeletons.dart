/// Dashboard-specific skeleton compositions — the Today and Weight card
/// placeholders, built from the shared skeleton primitives.
///
/// These mirror the real dashboard cards so the loading→loaded swap is calm.
/// The shared primitives ([SkeletonPulse], [SkeletonBar], [SkeletonCircle],
/// [SkeletonCard]) live in `shared/widgets/skeleton.dart`; only the
/// dashboard-shaped layouts live here.
library;

import 'package:flutter/material.dart';

import '../../../shared/widgets/skeleton.dart';
import '../logic/dashboard_spacing.dart';

// Re-export the shared skeleton primitives so dashboard widgets can pull the
// card compositions and the primitives they sit beside from one import.
export '../../../shared/widgets/skeleton.dart';

/// Inner placeholder rows for the Today card — hero + ring, three macro rows, a
/// divider gap, two meal rows. Mirrors the real card so the swap is calm. Used
/// inside a [SkeletonCard] (dashboard load) or directly under the card during a
/// per-day refetch.
List<Widget> todayCardSkeletonChildren() => [
      const Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SkeletonBar(width: 140, height: 34, radius: 8),
                SizedBox(height: DashboardSpacing.row),
                SkeletonBar(width: 90, height: 12, radius: 4),
              ],
            ),
          ),
          SkeletonCircle(size: 84),
        ],
      ),
      const SizedBox(height: DashboardSpacing.section),
      for (var i = 0; i < 3; i++) ...[
        if (i > 0) const SizedBox(height: DashboardSpacing.row * 2),
        const Row(
          children: [
            SkeletonBar(width: 56, height: 12, radius: 4),
            SizedBox(width: 12),
            Expanded(child: SkeletonBar(height: 8, radius: 4)),
            SizedBox(width: 12),
            SkeletonBar(width: 48, height: 12, radius: 4),
          ],
        ),
      ],
      // Stands in for the real card's hairline: section above + section below.
      const SizedBox(height: DashboardSpacing.section * 2),
      const SkeletonBar(widthFactor: 0.7, height: 13, radius: 4),
      const SizedBox(height: DashboardSpacing.row * 2),
      const SkeletonBar(widthFactor: 0.55, height: 13, radius: 4),
    ];

/// Inner placeholder rows for the Weight card — hero + stat, input field,
/// chart band.
List<Widget> weightCardSkeletonChildren() => const [
      Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SkeletonBar(width: 110, height: 34, radius: 8),
          SkeletonBar(width: 56, height: 22, radius: 6),
        ],
      ),
      SizedBox(height: DashboardSpacing.section),
      SkeletonBar(height: 52, radius: 14),
      SizedBox(height: DashboardSpacing.section),
      SkeletonBar(height: 96, radius: 10),
    ];

/// The out-of-card section eyebrow placeholder. Unlike the shared
/// [SkeletonHeader] it is spaced at [DashboardSpacing.block] and sized to the
/// Meta-12 label, matching the real `SectionHeader` (which carries no margin of
/// its own — the parent stack owns the gap), so loading→data doesn't jump.
class DashSkeletonHeader extends StatelessWidget {
  const DashSkeletonHeader({super.key});
  @override
  Widget build(BuildContext context) => const Padding(
        padding: EdgeInsets.only(bottom: DashboardSpacing.block),
        child: SkeletonPulse(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              SkeletonBar(width: 120, height: 12, radius: 4),
              SkeletonBar(width: 52, height: 12, radius: 4),
            ],
          ),
        ),
      );
}

/// The Today card placeholder (header + card), under one pulse.
class TodayCardSkeleton extends StatelessWidget {
  const TodayCardSkeleton({super.key});
  @override
  Widget build(BuildContext context) =>
      SkeletonCard(children: todayCardSkeletonChildren());
}

/// The Weight card placeholder (header + card), under one pulse.
class WeightCardSkeleton extends StatelessWidget {
  const WeightCardSkeleton({super.key});
  @override
  Widget build(BuildContext context) =>
      SkeletonCard(children: weightCardSkeletonChildren());
}
