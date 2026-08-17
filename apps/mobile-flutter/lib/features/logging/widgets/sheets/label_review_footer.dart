import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../shared/widgets/nham_text.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import 'scan_sheet_controls.dart';

/// Action row under the label review step: the reason confirm is disabled
/// (when it is), the confirm button itself, and the way back to the photo.
///
/// Split from `label_review_step.dart` to keep both under the 200-line widget
/// limit.
class LabelReviewFooter extends StatelessWidget {
  const LabelReviewFooter({
    super.key,
    required this.canConfirm,
    required this.saving,
    required this.onBack,
    required this.onConfirm,
  });

  final bool canConfirm;
  final bool saving;
  final VoidCallback onBack;
  final VoidCallback onConfirm;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;
    return Container(
      padding: EdgeInsets.fromLTRB(
        NhamSpacing.sp4,
        NhamSpacing.sp2,
        NhamSpacing.sp4,
        bottomInset + NhamSpacing.sp3,
      ),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: NhamColors.border)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (!canConfirm && !saving) ...[
            NhamText(
              'logging.labelScan.requiredValues'.tr(),
              variant: NhamTextVariant.small,
              style: const TextStyle(color: NhamColors.textMuted),
            ),
            const SizedBox(height: NhamSpacing.sp2),
          ],
          ScanPrimaryButton(
            label: 'logging.labelScan.addMeal'.tr(),
            enabled: canConfirm,
            busy: saving,
            onTap: onConfirm,
          ),
          if (!saving) ...[
            const SizedBox(height: NhamSpacing.sp1),
            Center(
              child: ScanQuietButton(
                icon: LucideIcons.arrowLeft300,
                label: 'logging.labelScan.back'.tr(),
                onTap: onBack,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
