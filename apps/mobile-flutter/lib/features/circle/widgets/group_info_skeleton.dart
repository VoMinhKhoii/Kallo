import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';
import 'friend_list_skeleton.dart';

/// Group-detail load skeleton: grab handle, centered name + member-count bars,
/// a members heading, then a few member-row placeholders.
class GroupDetailSkeleton extends StatelessWidget {
  const GroupDetailSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: tr('common.loading'),
      child: SkeletonPulse(
        child: ListView(
          padding: const EdgeInsets.all(KalloSpacing.sp5),
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: kHairline,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: KalloSpacing.sp4),
            const Center(child: SkeletonBar(width: 160, height: 20, radius: 8)),
            const SizedBox(height: KalloSpacing.sp2),
            const Center(child: SkeletonBar(width: 80, height: 12, radius: 6)),
            const SizedBox(height: KalloSpacing.sp4),
            const SkeletonBar(width: 96, height: 12, radius: 6),
            const SizedBox(height: KalloSpacing.sp2),
            for (var i = 0; i < 3; i++) const FriendRowSkeleton(),
          ],
        ),
      ),
    );
  }
}
