import 'package:flutter/material.dart';

import '../../../../shared/widgets/feedback/skeleton.dart';
import '../../logic/dashboard_spacing.dart';

/// The height of the bar [DashSkeletonHeader] draws for a section title.
const double kDashSkeletonTitleHeight = 18;

/// The out-of-card section-header placeholder. Unlike the shared
/// [SkeletonHeader] it is spaced at [DashboardSpacing.block] and sized to the
/// 17/600 title beside its 12 muted meta, matching [SectionHeaderRow] (which
/// carries no margin of its own — the parent stack owns the gap), so
/// loading→data doesn't jump.
class DashSkeletonHeader extends StatelessWidget {
  const DashSkeletonHeader({super.key});
  @override
  Widget build(BuildContext context) => const Padding(
    padding: EdgeInsets.only(bottom: DashboardSpacing.block),
    child: SkeletonPulse(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          SkeletonBar(width: 120, height: kDashSkeletonTitleHeight, radius: 4),
          SkeletonBar(width: 52, height: 12, radius: 4),
        ],
      ),
    ),
  );
}
