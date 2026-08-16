import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../shared/widgets/skeleton.dart';
import '../../../theme/kallo_theme.dart';

/// Inviter-card skeleton: disc + title/body bars + an Accept-button bar,
/// mirroring the resolved invite-preview panel shape on the connect screen.
class ConnectPreviewSkeleton extends StatelessWidget {
  const ConnectPreviewSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: tr('common.loading'),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 360),
        child: const SkeletonPulse(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SkeletonCircle(size: 56),
              SizedBox(height: KalloSpacing.sp5),
              SkeletonBar(width: 180, height: 20, radius: 8),
              SizedBox(height: KalloSpacing.sp2),
              SkeletonBar(width: 240, height: 12, radius: 6),
              SizedBox(height: KalloSpacing.sp5),
              SizedBox(
                width: double.infinity,
                child: SkeletonBar(height: 48, radius: 12),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
