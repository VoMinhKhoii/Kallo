import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../shared/widgets/nham_text.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import '../../logic/label_nutrients.dart';
import '../../logic/label_review.dart';
import 'label_nutrient_grid.dart';
import 'label_product_name_field.dart';
import 'label_review_footer.dart';
import 'label_review_metadata.dart';
import 'label_review_quantity.dart';

/// Check and correct what the scan read off the label, then log it.
///
/// Port of `components/logging/input/ocr-review-step.tsx`. Owns no nutrition
/// logic itself — [review] is the ported `useOcrReviewState`, so the amount
/// rescaling and validation are the web's, unit-tested in
/// `test/label_review_test.dart`.
class LabelReviewStep extends StatefulWidget {
  const LabelReviewStep({
    super.key,
    required this.review,
    required this.saving,
    required this.onBack,
    required this.onConfirm,
    this.errorText,
  });

  final LabelReviewState review;
  final bool saving;
  final VoidCallback onBack;
  final VoidCallback onConfirm;

  /// Inline save error, shown above the footer so the user's edits survive a
  /// failed attempt.
  final String? errorText;

  @override
  State<LabelReviewStep> createState() => _LabelReviewStepState();
}

class _LabelReviewStepState extends State<LabelReviewStep> {
  /// Flipped by the first save attempt. Until then an untouched form shows no
  /// errors; after it, every required field that is still empty says so.
  bool _submitAttempted = false;

  late final TextEditingController _name = TextEditingController(
    text: widget.review.productName,
  );
  late final TextEditingController _amount = TextEditingController(
    text: widget.review.amountText,
  );

  @override
  void dispose() {
    _name.dispose();
    _amount.dispose();
    super.dispose();
  }

  void _commitAmount(String value) {
    widget.review.commitAmount(value);
    _amount.text = widget.review.amountText;
    setState(() {});
  }

  void _confirm() {
    if (!widget.review.canConfirm) {
      setState(() => _submitAttempted = true);
      return;
    }
    widget.onConfirm();
  }

  String get _unitLabel => widget.review.unit == 'serving'
      ? plural('logging.labelScan.unit.serving', widget.review.parsedAmount ?? 0)
      : 'logging.labelScan.unit.${widget.review.unit}'.tr();

  @override
  Widget build(BuildContext context) {
    final review = widget.review;
    final micronutrients = labelMicronutrientDefinitions
        .where((d) => review.initialNutrition[d.key] != null)
        .toList();

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Flexible(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(
              NhamSpacing.sp4,
              NhamSpacing.sp2,
              NhamSpacing.sp4,
              NhamSpacing.sp3,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                LabelProductNameField(
                  controller: _name,
                  isValid: review.productIsValid,
                  enabled: !widget.saving,
                  onChanged: (value) =>
                      setState(() => review.productName = value),
                ),
                const SizedBox(height: NhamSpacing.sp3),
                if (review.label != null) ...[
                  LabelReviewMetadata(label: review.label!),
                  const SizedBox(height: NhamSpacing.sp3),
                ],
                LabelReviewQuantity(
                  controller: _amount,
                  unitLabel: _unitLabel,
                  isValid: review.amountIsValid,
                  shortcuts: review.shortcuts,
                  enabled: !widget.saving,
                  onChanged: (value) =>
                      setState(() => review.amountText = value),
                  onCommit: _commitAmount,
                ),
                const SizedBox(height: NhamSpacing.sp3),
                LabelNutrientGrid(
                  definitions: labelMacroDefinitions,
                  layout: LabelGridLayout.macros,
                  showMissing: _submitAttempted,
                  enabled: !widget.saving,
                  textFor: review.nutrientText,
                  hasError: review.nutrientHasError,
                  onChanged: (key, value) =>
                      setState(() => review.setNutrientText(key, value)),
                ),
                if (micronutrients.isNotEmpty) ...[
                  const SizedBox(height: NhamSpacing.sp3),
                  _label('logging.labelScan.micronutrients'.tr()),
                  const SizedBox(height: NhamSpacing.sp2),
                  LabelNutrientGrid(
                    definitions: micronutrients,
                    layout: LabelGridLayout.micronutrients,
                    enabled: !widget.saving,
                    textFor: review.nutrientText,
                    hasError: review.nutrientHasError,
                    onChanged: (key, value) =>
                        setState(() => review.setNutrientText(key, value)),
                  ),
                ],
                if (widget.errorText != null) ...[
                  const SizedBox(height: NhamSpacing.sp3),
                  _danger(widget.errorText!),
                ],
              ],
            ),
          ),
        ),
        LabelReviewFooter(
          saving: widget.saving,
          onBack: widget.onBack,
          onConfirm: _confirm,
        ),
      ],
    );
  }

  Widget _label(String text) => NhamText(
    text,
    variant: NhamTextVariant.small,
    style: const TextStyle(color: NhamColors.textMuted),
  );

  Widget _danger(String text) => NhamText(
    text,
    variant: NhamTextVariant.small,
    style: const TextStyle(color: NhamColors.danger),
  );
}
