import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../shared/widgets/form/sheet_action_buttons.dart';
import '../../../../../shared/widgets/form/sheet_confirm_button.dart';
import '../../../../../theme/calm_tokens.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';

/// The pinned bottom of the barcode quantity step: an inline save error (so a
/// failed attempt keeps the amount), the way back, and the confirm button.
///
/// Split from `barcode_product_step.dart` to keep both under the 200-line
/// widget limit, as `label_review_footer.dart` is for the label step.
class BarcodeProductFooter extends StatelessWidget {
  const BarcodeProductFooter({
    super.key,
    required this.confirmLabel,
    required this.saving,
    required this.onBack,
    required this.onConfirm,
    this.errorText,
  });

  final String confirmLabel;
  final bool saving;
  final VoidCallback onBack;
  final VoidCallback onConfirm;
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    final error = errorText;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (error != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(
              KalloSpacing.sp4,
              0,
              KalloSpacing.sp4,
              KalloSpacing.sp2,
            ),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(error, style: dashMeta(color: KalloColors.danger)),
            ),
          ),
        Container(
          padding: EdgeInsets.fromLTRB(
            KalloSpacing.sp4,
            KalloSpacing.sp3,
            KalloSpacing.sp4,
            MediaQuery.of(context).padding.bottom + KalloSpacing.sp3,
          ),
          decoration: const BoxDecoration(
            color: KalloColors.elev,
            border: Border(top: BorderSide(color: KalloColors.borderFaint)),
          ),
          child: Row(
            children: [
              // Deliberately silent: leaving the step is not a confirmation,
              // so it gets no haptic the way the other quiet links do.
              QuietIconButton(
                icon: LucideIcons.arrowLeft300,
                label: 'logging.barcode.back'.tr(),
                onTap: saving ? null : onBack,
                haptic: false,
              ),
              const Spacer(),
              SheetConfirmButton(
                label: confirmLabel,
                saving: saving,
                onTap: onConfirm,
              ),
            ],
          ),
        ),
      ],
    );
  }
}
