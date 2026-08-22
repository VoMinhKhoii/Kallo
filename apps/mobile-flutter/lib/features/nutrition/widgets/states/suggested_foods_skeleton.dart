import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/widgets/feedback/skeleton.dart';
import '../../../../theme/kallo_theme.dart';

/// Candidates load skeleton — a few pill-shaped bars mirroring the food chips.
class CandidatesSkeleton extends StatelessWidget {
  const CandidatesSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: tr('nutrition.candidates.loading'),
      child: const SkeletonPulse(
        child: Wrap(
          spacing: KalloSpacing.sp2,
          runSpacing: KalloSpacing.sp2,
          children: [
            SkeletonBar(width: 96, height: 30, radius: KalloRadii.pill),
            SkeletonBar(width: 72, height: 30, radius: KalloRadii.pill),
            SkeletonBar(width: 120, height: 30, radius: KalloRadii.pill),
          ],
        ),
      ),
    );
  }
}
