import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import '../../logic/label_review.dart';
import 'label_field_chrome.dart';

/// How much of it the user actually ate — the figure every nutrient above
/// rescales against.
///
/// Shortcuts appear only when they would actually change the amount: offering
/// "1 serving" while the field already reads one serving is a button that does
/// nothing, which is most of what made this sheet feel like a form.
class LabelReviewQuantity extends StatefulWidget {
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

  @override
  State<LabelReviewQuantity> createState() => _LabelReviewQuantityState();
}

class _LabelReviewQuantityState extends State<LabelReviewQuantity> {
  final FocusNode _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _focus.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  bool _differs(double amount) {
    final current = widget.currentAmount;
    return current == null || (current - amount).abs() > 0.001;
  }

  @override
  Widget build(BuildContext context) {
    final serving = widget.shortcuts.servingAmount;
    final package = widget.shortcuts.packageAmount;
    final chips = <(String, double)>[
      if (serving != null && _differs(serving))
        ('logging.labelScan.servingShortcut'.tr(), serving),
      if (package != null && _differs(package))
        ('logging.labelScan.packageShortcut'.tr(), package),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('logging.labelScan.amountLabel'.tr(), style: dashMeta()),
        const SizedBox(height: NhamSpacing.sp1),
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Flexible(
              child: TextField(
                controller: widget.controller,
                focusNode: _focus,
                enabled: widget.enabled,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
                ],
                onChanged: widget.onChanged,
                onEditingComplete: () => widget.onCommit(
                  widget.controller.text,
                ),
                onTapOutside: (_) => widget.onCommit(widget.controller.text),
                cursorColor: NhamColors.accent,
                style: dashValue(
                  color: widget.isValid ? kInk : NhamColors.danger,
                ),
                decoration: labelFieldDecoration(),
              ),
            ),
            const SizedBox(width: 4),
            Text(widget.unitLabel, style: dashMeta()),
          ],
        ),
        const SizedBox(height: NhamSpacing.sp1),
        LabelFieldRule(hasError: !widget.isValid, focused: _focus.hasFocus),
        if (!widget.isValid) ...[
          const SizedBox(height: NhamSpacing.sp1),
          Text(
            'logging.labelScan.invalidAmount'.tr(),
            style: dashMeta(color: NhamColors.danger),
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
                  onTap: widget.enabled
                      ? () {
                          HapticFeedback.selectionClick();
                          widget.onCommit(formatLabelNumber(amount));
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
            color: NhamColors.hover,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(label, style: dashMeta(color: kInk)),
        ),
      ),
    );
  }
}
