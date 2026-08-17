import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../shared/widgets/nham_text.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import '../../../../theme/nham_typography.dart';
import '../../logic/label_review.dart';

/// How much of it the user actually ate, with one-tap shortcuts for the
/// stated serving and the whole package.
///
/// Port of `components/logging/input/ocr-review-quantity.tsx`. Editing this
/// rescales every nutrient below it.
class LabelReviewQuantity extends StatelessWidget {
  const LabelReviewQuantity({
    super.key,
    required this.controller,
    required this.unitLabel,
    required this.isValid,
    required this.shortcuts,
    required this.onChanged,
    required this.onCommit,
    this.enabled = true,
  });

  final TextEditingController controller;
  final String unitLabel;
  final bool isValid;
  final LabelAmountShortcuts shortcuts;
  final ValueChanged<String> onChanged;
  final ValueChanged<String> onCommit;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final chips = <(String, double)>[
      if (shortcuts.servingAmount != null)
        ('logging.labelScan.servingShortcut'.tr(), shortcuts.servingAmount!),
      if (shortcuts.packageAmount != null)
        ('logging.labelScan.packageShortcut'.tr(), shortcuts.packageAmount!),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        NhamText(
          'logging.labelScan.amountLabel'.tr(),
          variant: NhamTextVariant.small,
          style: const TextStyle(color: NhamColors.textMuted),
        ),
        const SizedBox(height: 4),
        TextField(
          controller: controller,
          enabled: enabled,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          inputFormatters: [
            FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
          ],
          onChanged: onChanged,
          onEditingComplete: () => onCommit(controller.text),
          onTapOutside: (_) => onCommit(controller.text),
          style: NhamTextStyles.sansMedium(
            fontSize: NhamFontSize.md,
          ).copyWith(color: NhamColors.text),
          cursorColor: NhamColors.accent,
          decoration: InputDecoration(
            isDense: true,
            filled: true,
            fillColor: NhamColors.elev,
            suffixText: unitLabel,
            suffixStyle: NhamTextStyles.sansRegular(
              fontSize: NhamFontSize.sm,
            ).copyWith(color: NhamColors.textMuted),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: NhamSpacing.sp3,
              vertical: NhamSpacing.sp2,
            ),
            border: _border(isValid),
            enabledBorder: _border(isValid),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(NhamRadii.lg),
              borderSide: BorderSide(
                color: isValid ? NhamColors.borderAccent40 : NhamColors.danger,
              ),
            ),
          ),
        ),
        if (!isValid) ...[
          const SizedBox(height: 4),
          NhamText(
            'logging.labelScan.invalidAmount'.tr(),
            variant: NhamTextVariant.small,
            style: const TextStyle(color: NhamColors.danger),
          ),
        ],
        if (chips.isNotEmpty) ...[
          const SizedBox(height: NhamSpacing.sp2),
          Wrap(
            spacing: NhamSpacing.sp2,
            children: [
              for (final (label, amount) in chips)
                _AmountChip(
                  label: label,
                  onTap: enabled
                      ? () {
                          HapticFeedback.selectionClick();
                          onCommit(formatLabelNumber(amount));
                        }
                      : null,
                ),
            ],
          ),
        ],
      ],
    );
  }

  OutlineInputBorder _border(bool valid) => OutlineInputBorder(
    borderRadius: BorderRadius.circular(NhamRadii.lg),
    borderSide: BorderSide(
      color: valid ? NhamColors.inputBorder : NhamColors.danger,
    ),
  );
}

class _AmountChip extends StatelessWidget {
  const _AmountChip({required this.label, this.onTap});

  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          decoration: BoxDecoration(
            color: NhamColors.elev,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: NhamColors.border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                LucideIcons.zap300,
                size: 13,
                color: NhamColors.textMuted,
              ),
              const SizedBox(width: 5),
              Text(
                label,
                style: NhamTextStyles.sansMedium(
                  fontSize: NhamFontSize.xs,
                ).copyWith(color: NhamColors.text),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
