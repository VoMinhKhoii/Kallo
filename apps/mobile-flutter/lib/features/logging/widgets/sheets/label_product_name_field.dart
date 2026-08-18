import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/widgets/nham_text.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import '../../../../theme/nham_typography.dart';

/// What the meal will be called once it is logged — seeded from the label, or
/// from a fallback when the scan couldn't read a product name.
///
/// Split from `label_review_step.dart` to keep that file under the 200-line
/// widget limit.
class LabelProductNameField extends StatelessWidget {
  const LabelProductNameField({
    super.key,
    required this.controller,
    required this.isValid,
    required this.enabled,
    required this.onChanged,
  });

  final TextEditingController controller;
  final bool isValid;
  final bool enabled;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        NhamText(
          'logging.labelScan.productName'.tr(),
          variant: NhamTextVariant.small,
          style: const TextStyle(color: NhamColors.textMuted),
        ),
        const SizedBox(height: 4),
        TextField(
          controller: controller,
          enabled: enabled,
          onChanged: onChanged,
          style: NhamTextStyles.sansMedium(
            fontSize: NhamFontSize.sm,
          ).copyWith(color: NhamColors.text),
          cursorColor: NhamColors.accent,
          decoration: InputDecoration(
            isDense: true,
            filled: true,
            fillColor: NhamColors.elev,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: NhamSpacing.sp3,
              vertical: NhamSpacing.sp2,
            ),
            border: _border,
            enabledBorder: _border,
            focusedBorder: _border,
          ),
        ),
        if (!isValid) ...[
          const SizedBox(height: 4),
          NhamText(
            'logging.labelScan.invalidProductName'.tr(),
            variant: NhamTextVariant.small,
            style: const TextStyle(color: NhamColors.danger),
          ),
        ],
      ],
    );
  }

  OutlineInputBorder get _border => OutlineInputBorder(
    borderRadius: BorderRadius.circular(NhamRadii.lg),
    borderSide: BorderSide(
      color: isValid ? NhamColors.inputBorder : NhamColors.danger,
    ),
  );
}
