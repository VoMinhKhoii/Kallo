import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../shared/widgets/skeleton.dart';
import '../../../theme/kallo_theme.dart';

/// Profile-load skeleton for the add-friend sheet — an avatar disc beside a
/// name + invite-link bar, mirroring the resolved `_ProfileSection` layout.
class AddFriendProfileSkeleton extends StatelessWidget {
  const AddFriendProfileSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: tr('common.loading'),
      child: const SizedBox(
        height: 84,
        child: SkeletonPulse(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              SkeletonCircle(size: 40),
              SizedBox(width: KalloSpacing.sp3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    SkeletonBar(width: 140, height: 14, radius: 6),
                    SizedBox(height: KalloSpacing.sp2),
                    SkeletonBar(widthFactor: 0.85, height: 12, radius: 6),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
