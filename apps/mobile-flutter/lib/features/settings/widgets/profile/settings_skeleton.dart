import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/widgets/feedback/skeleton.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/settings_spacing.dart';

/// Profile-load skeleton for the settings editor — a stack of label + field
/// rows mirroring the form the editor renders.
class SettingsSkeleton extends StatelessWidget {
  const SettingsSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: tr('common.loading'),
      child: SkeletonPulse(
        child: ListView(
          // Same inset as the editor it stands in for — the swap doesn't jump.
          padding: SettingsSpacing.page(context),
          children: [
            for (var i = 0; i < 4; i++) ...[
              if (i > 0) const SizedBox(height: KalloSpacing.sp5),
              const SkeletonBar(width: 120, height: 12, radius: 6),
              const SizedBox(height: KalloSpacing.sp2),
              const SkeletonBar(height: 48, radius: 12),
            ],
          ],
        ),
      ),
    );
  }
}
