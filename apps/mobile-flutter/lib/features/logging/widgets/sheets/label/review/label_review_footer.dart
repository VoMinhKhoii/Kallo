import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../../shared/widgets/form/sheet_action_buttons.dart';
import '../../../../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../../../../theme/kallo_colors.dart';
import '../../../../../../theme/kallo_theme.dart';

/// Action row under the label review step: the reason confirm is disabled
/// (when it is), the confirm button itself, and the way back to the photo.
///
/// Split from `label_review_step.dart` to keep both under the 200-line widget
/// limit.
class LabelReviewFooter extends StatelessWidget {
  const LabelReviewFooter({
    super.key,
    required this.saving,
    required this.onBack,
    required this.onConfirm,
  });

  final bool saving;
  final VoidCallback onBack;
  final VoidCallback onConfirm;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;
    return Container(
      padding: EdgeInsets.fromLTRB(
        KalloSpacing.sp4,
        KalloSpacing.sp2,
        KalloSpacing.sp4,
        bottomInset + KalloSpacing.sp3,
      ),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: KalloColors.border)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Always tappable. A gap is reported by the fields that have it,
          // when the user asks to save — not by a sentence under a dead
          // button explaining why nothing happens.
          KalloButton(
            title: 'logging.labelScan.addMeal'.tr(),
            loading: saving,
            onPressed: onConfirm,
          ),
          if (!saving) ...[
            const SizedBox(height: KalloSpacing.sp1),
            Center(
              child: QuietIconButton(
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
