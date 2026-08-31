import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/widgets/feedback/skeleton.dart';
import '../../../../shared/widgets/list/grouped_list_card.dart';
import '../../../../theme/kallo_theme.dart';
import '../feed/feed_day_group.dart';

/// Loading state for one day of the feed: the group label, then the white day
/// card with placeholder posts inside it — the same shell the real feed lands
/// in, so nothing jumps when it does (native pass, 2026-08-31).
class CircleWallSkeleton extends StatelessWidget {
  const CircleWallSkeleton({this.rows = 3, super.key});

  final int rows;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: tr('groups.wall.loading'),
      child: SkeletonPulse(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SkeletonBar(width: 64, height: 14),
            const SizedBox(height: KalloSpacing.sp3),
            GroupedListCard(
              separatorInset: kContentRail,
              children: [
                for (var i = 0; i < rows; i++)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: KalloSpacing.sp3),
                    child: _SkeletonRow(),
                  ),
              ],
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
    return const Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SkeletonCircle(size: 32),
        SizedBox(width: KalloSpacing.sp3),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  SkeletonBar(width: 96, height: 14),
                  SizedBox(width: KalloSpacing.sp2),
                  SkeletonBar(width: 56, height: 12),
                ],
              ),
              SizedBox(height: KalloSpacing.sp2),
              SkeletonBar(widthFactor: 0.7, height: 14),
              SizedBox(height: KalloSpacing.sp2),
              SkeletonBar(height: 6),
              SizedBox(height: KalloSpacing.sp1_5),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  SkeletonBar(width: 64, height: 14),
                  SkeletonBar(width: 150, height: 12),
                ],
              ),
              SizedBox(height: KalloSpacing.sp4),
              SkeletonBar(width: 132, height: 24),
            ],
          ),
        ),
      ],
    );
  }
}
