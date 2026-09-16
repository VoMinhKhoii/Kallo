import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/split_parts.dart';

/// The pinned footer: the primary, and a cancel beneath it.
///
/// The button carries the whole consequence of the share — what you keep — so
/// the sheet needs no separate warning line. Cancel sits under the primary
/// rather than beside it: two side-by-side buttons make neither one primary.
class ShareMealFooter extends StatelessWidget {
  const ShareMealFooter({
    super.key,
    required this.seatedCount,
    required this.keptParts,
    required this.totalKcal,
    required this.canSubmit,
    required this.onSubmit,
    required this.onCancel,
  });

  final int seatedCount;
  final int keptParts;
  final double? totalKcal;
  final bool canSubmit;
  final VoidCallback onSubmit;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final kept = totalKcal == null
        ? null
        : (totalKcal! * keptParts / kTotalParts).round();

    final label = seatedCount == 0
        ? tr('groups.shareMeal.submitEmpty')
        : kept == null
            ? 'groups.shareMeal.submitNoKcal'
                .plural(seatedCount, namedArgs: {'count': '$seatedCount'})
            : 'groups.shareMeal.submit'.plural(
                seatedCount,
                namedArgs: {'count': '$seatedCount', 'kcal': '$kept'},
              );

    return Container(
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: KalloColors.borderFaint)),
      ),
      padding: const EdgeInsets.fromLTRB(
        KalloSpacing.sp4,
        KalloSpacing.sp3,
        KalloSpacing.sp4,
        KalloSpacing.sp5,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          KalloButton(
            title: label,
            animateTitle: true,
            disabled: !canSubmit,
            onPressed: onSubmit,
          ),
          const SizedBox(height: KalloSpacing.sp2),
          KalloButton(
            variant: KalloButtonVariant.ghost,
            title: tr('common.cancel'),
            onPressed: onCancel,
          ),
        ],
      ),
    );
  }
}
