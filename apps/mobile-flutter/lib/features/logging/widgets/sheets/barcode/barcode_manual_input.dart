import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../shared/widgets/form/sheet_action_buttons.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';
import '../../../../../theme/kallo_typography.dart';

/// Type the barcode by hand when the camera cannot read it (or does not
/// exist). Port of the web's `barcode-manual-input.tsx`.
class BarcodeManualInput extends StatelessWidget {
  const BarcodeManualInput({
    super.key,
    required this.controller,
    required this.onSubmit,
    required this.onBackToCamera,
  });

  final TextEditingController controller;
  final VoidCallback onSubmit;
  final VoidCallback onBackToCamera;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(
        KalloSpacing.sp4,
        KalloSpacing.sp2,
        KalloSpacing.sp4,
        bottomInset + KalloSpacing.sp3,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: controller,
            autofocus: true,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onSubmitted: (_) => onSubmit(),
            style: KalloTextStyles.sansRegular(
              fontSize: KalloFontSize.sm,
            ).copyWith(color: KalloColors.text),
            cursorColor: KalloColors.accent,
            decoration: InputDecoration(
              isDense: true,
              prefixIcon: const Icon(
                LucideIcons.scanBarcode300,
                size: 18,
                color: KalloColors.textMuted,
              ),
              hintText: 'logging.barcode.placeholder'.tr(),
              hintStyle: KalloTextStyles.sansRegular(
                fontSize: KalloFontSize.sm,
              ).copyWith(color: KalloColors.placeholderMuted40),
              filled: true,
              fillColor: KalloColors.elev,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: KalloSpacing.sp3,
                vertical: KalloSpacing.sp2,
              ),
              border: _border(KalloColors.inputBorder),
              enabledBorder: _border(KalloColors.inputBorder),
              focusedBorder: _border(KalloColors.borderAccent40),
            ),
          ),
          const SizedBox(height: KalloSpacing.sp3),
          SheetPrimaryButton(
            label: 'logging.barcode.search'.tr(),
            onTap: onSubmit,
          ),
          const SizedBox(height: KalloSpacing.sp2),
          Center(
            child: QuietIconButton(
              icon: LucideIcons.camera300,
              label: 'logging.barcode.backToCamera'.tr(),
              onTap: onBackToCamera,
            ),
          ),
        ],
      ),
    );
  }

  OutlineInputBorder _border(Color color) => OutlineInputBorder(
    borderRadius: BorderRadius.circular(KalloRadii.lg),
    borderSide: BorderSide(color: color),
  );
}
