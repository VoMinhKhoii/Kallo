import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../dashboard/widgets/skeleton.dart';

/// Loading state for the Circle wall. Mirrors the timeline + card geometry of
/// `CircleCard` (identity row, quote line, macro summary) so the layout doesn't
/// shift when real data arrives, and prevents a flash of the empty state during
/// the initial fetch. Mirrors `components/groups/circle-wall-skeleton.tsx`.
class CircleWallSkeleton extends StatelessWidget {
  const CircleWallSkeleton({this.rows = 3, super.key});

  final int rows;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: tr('groups.wall.loading'),
      child: Shimmer(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var i = 0; i < rows; i++)
              Padding(
                padding: EdgeInsets.only(
                  bottom: i == rows - 1 ? 0 : NhamSpacing.sp6,
                ),
                child: const _SkeletonRow(),
              ),
          ],
        ),
      ),
    );
  }
}

class _SkeletonRow extends StatelessWidget {
  const _SkeletonRow();

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Timeline gutter with the dot.
        const SizedBox(
          width: 22,
          child: Padding(
            padding: EdgeInsets.only(top: 6, left: 6),
            child: SkeletonCircle(size: 9),
          ),
        ),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Friend identity row: 24px disc + name bar + time bar.
              const Row(
                children: [
                  SkeletonCircle(size: 24),
                  SizedBox(width: NhamSpacing.sp2),
                  SkeletonBar(width: 96, height: 12),
                  SizedBox(width: NhamSpacing.sp2),
                  SkeletonBar(width: 56, height: 10),
                ],
              ),
              const SizedBox(height: NhamSpacing.sp2),
              // Card: quote line + chevron disc, then the macro summary row.
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(NhamSpacing.sp4),
                decoration: BoxDecoration(
                  color: NhamColors.elev,
                  borderRadius: BorderRadius.circular(NhamRadii.containerLg),
                  border: Border.all(color: NhamColors.borderSoft),
                ),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: SkeletonBar(widthFactor: 0.6, height: 20),
                        ),
                        SizedBox(width: NhamSpacing.sp3),
                        SkeletonCircle(size: 24),
                      ],
                    ),
                    SizedBox(height: NhamSpacing.sp3),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        SkeletonBar(width: 112, height: 12),
                        SkeletonBar(width: 64, height: 14),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
