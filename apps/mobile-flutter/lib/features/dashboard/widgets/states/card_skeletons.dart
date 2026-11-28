/// Dashboard-specific skeleton compositions — the Today and Weight card
/// placeholders, built from the shared skeleton primitives.
///
/// These mirror the real dashboard cards so the loading→loaded swap is calm.
/// The shared primitives ([SkeletonPulse], [SkeletonBar], [SkeletonCircle],
/// [SkeletonCard]) live in `shared/widgets/feedback/skeleton.dart`; only
/// the dashboard-shaped layouts live here.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../../shared/widgets/feedback/kallo_refresh.dart';
import '../../../../shared/widgets/feedback/skeleton.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/dashboard_spacing.dart';
import '../../logic/today_dial_layout.dart';
import 'dash_skeleton_header.dart';
import 'dashboard_pane_skeleton.dart';
import 'today_row_skeleton.dart';

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
  ...todayMealSkeletonChildren(),
];

/// The two meal rows at the foot of the Today placeholder.
List<Widget> todayMealSkeletonChildren() => const [
  SkeletonBar(widthFactor: 0.7, height: 13, radius: 4),
  SizedBox(height: DashboardSpacing.row * 2),
  SkeletonBar(widthFactor: 0.55, height: 13, radius: 4),
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

/// The Today card placeholder (header + card), under one pulse. Where Today
/// draws its dials in one row, the placeholder takes that row's shape too.
class TodayCardSkeleton extends StatelessWidget {
  const TodayCardSkeleton({super.key});
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      if (!todayDialsInOneRow(context, constraints.maxWidth)) {
        return SkeletonCard(children: todayCardSkeletonChildren());
      }
      // The real title is one line of kSectionHeader, a little taller than
      // the bar standing in for it. Making up the difference here puts the
      // calorie placeholder on the rect its arc lands on.
      final title = kSectionHeader();
      final line =
          MediaQuery.textScalerOf(context).scale(title.fontSize!) *
          title.height!;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(height: math.max(0, line - kDashSkeletonTitleHeight)),
          const TodayRowSkeleton(),
          const SizedBox(height: DashboardSpacing.sectionBreak),
          const DashSkeletonHeader(),
          SkeletonCard(children: todayMealSkeletonChildren()),
        ],
      );
    },
  );
}

/// The Weight card placeholder (header + card), under one pulse.
class WeightCardSkeleton extends StatelessWidget {
  const WeightCardSkeleton({super.key});
  @override
  Widget build(BuildContext context) =>
      SkeletonCard(children: weightCardSkeletonChildren());
}

/// The full-page loading skeleton — a week-strip row, the Today card, and the
/// two lower section cards, all under one shimmer sweep. Mirrors the loaded
/// page's scroll and padding so the swap to real data doesn't jump.
class DashboardSkeleton extends StatelessWidget {
  const DashboardSkeleton({super.key, required this.onRefresh});

  /// The same refetch the loaded page pulls. A first load that hangs is the
  /// state where a pull is most wanted, and it was the one state that had no
  /// refresh control (and no bouncing physics) at all.
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    // The pulse comes from the caller (one outer SkeletonPulse); every card /
    // header / bar below inherits it and fades in phase.
    final single = KalloRefreshableScroll(
      onRefresh: onRefresh,
      slivers:
          (bottomInset) => [
            SliverPadding(
              padding: EdgeInsets.only(
                left: KalloSpacing.sp3,
                right: KalloSpacing.sp3,
                top: KalloSpacing.sp2,
                bottom: bottomInset,
              ),
              sliver: SliverList(
                delegate: SliverChildListDelegate(const [
                  // Week-strip row — four day pills (the strip's own height, then
                  // the one block gap it carries under itself).
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      SkeletonBar(width: 64, height: 72, radius: 16),
                      SkeletonBar(width: 64, height: 72, radius: 16),
                      SkeletonBar(width: 64, height: 72, radius: 16),
                      SkeletonBar(width: 64, height: 72, radius: 16),
                    ],
                  ),
                  SizedBox(height: DashboardSpacing.block),
                  // Section 1 — Today.
                  DashSkeletonHeader(),
                  TodayCardSkeleton(),
                  SizedBox(height: DashboardSpacing.block),
                  // Section 2 — Progress.
                  DashSkeletonHeader(),
                  WeightCardSkeleton(),
                  SizedBox(height: DashboardSpacing.block),
                  // Section 3 — Consistency.
                  DashSkeletonHeader(),
                  SkeletonCard(
                    children: [SkeletonBar(height: 120, radius: 10)],
                  ),
                ]),
              ),
            ),
          ],
    );
    return DashboardPaneSkeleton(onRefresh: onRefresh, single: single);
  }
}
