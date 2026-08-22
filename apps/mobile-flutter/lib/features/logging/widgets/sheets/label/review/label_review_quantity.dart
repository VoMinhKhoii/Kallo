import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../../../theme/calm_tokens.dart';
import '../../../../../../theme/kallo_colors.dart';
import '../../../../../../theme/kallo_theme.dart';
import '../../../../logic/label/review.dart';
import 'label_field.dart';
import 'label_field_label.dart';

/// How much of it the user actually ate — the figure every nutrient above
/// rescales against.
///
/// Shortcuts appear only when they would actually change the amount: offering
/// "1 serving" while the field already reads one serving is a button that does
/// nothing, which is most of what made this sheet feel like a form.
class LabelReviewQuantity extends StatelessWidget {
  const LabelReviewQuantity({
    super.key,
    required this.controller,
    required this.unitLabel,
    required this.isValid,
    required this.shortcuts,
    required this.currentAmount,
    required this.onChanged,
    required this.onCommit,
    this.enabled = true,
  });

  final TextEditingController controller;
  final String unitLabel;
  final bool isValid;
  final LabelAmountShortcuts shortcuts;

  /// The amount currently in the field, so a shortcut equal to it is dropped.
  final double? currentAmount;
  final ValueChanged<String> onChanged;
  final ValueChanged<String> onCommit;
  final bool enabled;

  bool _differs(double amount) {
    final current = currentAmount;
    return current == null || (current - amount).abs() > 0.001;
  }

  @override
  Widget build(BuildContext context) {
    final serving = shortcuts.servingAmount;
    final package = shortcuts.packageAmount;
    final chips = <(String, double)>[
      if (serving != null && _differs(serving))
        ('logging.labelScan.servingShortcut'.tr(), serving),
      if (package != null && _differs(package))
        ('logging.labelScan.packageShortcut'.tr(), package),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        LabelField(
          controller: controller,
          textStyle: dashValue(),
          unit: unitLabel,
          hasError: !isValid,
          errorText: 'logging.labelScan.invalidAmount'.tr(),
          enabled: enabled,
          onChanged: onChanged,
          onCommit: onCommit,
          label: LabelFieldLabel(text: 'logging.labelScan.amountLabel'.tr()),
        ),
        if (chips.isNotEmpty) ...[
          const SizedBox(height: KalloSpacing.sp2),
          Wrap(
            spacing: KalloSpacing.sp2,
            children: [
              for (final (label, amount) in chips)
                _AmountChip(
                  label: label,
                  onTap:
                      enabled
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
            color: KalloColors.hover,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(label, style: dashMeta(color: kInk)),
        ),
      ),
    );
  }
}
