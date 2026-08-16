import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';
import '../../../shared/widgets/skeleton.dart';

/// Flat feed-row loading state matching avatar, text, macros, and actions.
class CircleWallSkeleton extends StatelessWidget {
  const CircleWallSkeleton({this.rows = 3, super.key});

  final int rows;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: tr('groups.wall.loading'),
      child: SkeletonPulse(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var i = 0; i < rows; i++)
              Padding(
                padding: EdgeInsets.only(
                  bottom: i == rows - 1 ? 0 : KalloSpacing.sp4,
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
    return const Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SkeletonCircle(size: 36),
        SizedBox(width: KalloSpacing.sp3),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  SkeletonBar(width: 96, height: 12),
                  SizedBox(width: KalloSpacing.sp2),
                  SkeletonBar(width: 56, height: 10),
                ],
              ),
              SizedBox(height: KalloSpacing.sp2),
              SkeletonBar(widthFactor: 0.7, height: 14),
              SizedBox(height: KalloSpacing.sp2),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  SkeletonBar(width: 150, height: 10),
                  SkeletonBar(width: 64, height: 12),
                ],
              ),
              SizedBox(height: KalloSpacing.sp2),
              SkeletonBar(width: 92, height: 10),
              SizedBox(height: KalloSpacing.sp4),
              Divider(height: 1, color: kHairline),
            ],
          ),
        ),
      ],
    );
  }
}
