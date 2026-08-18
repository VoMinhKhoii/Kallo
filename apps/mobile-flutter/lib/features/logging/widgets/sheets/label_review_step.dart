import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import '../../logic/label_nutrients.dart';
import '../../logic/label_review.dart';
import 'label_calorie_hero.dart';
import 'label_review_fields.dart';
import 'label_macro_row.dart';
import 'label_micronutrients.dart';
import 'label_product_name_field.dart';
import 'label_review_footer.dart';
import 'label_review_metadata.dart';
import 'label_review_quantity.dart';

/// Check and correct what the scan read off the label, then log it.
///
/// Reads top-down as an answer, not a form: the calorie figure the meal is
/// worth, the three macros under it, then what it was and how much of it —
/// context, which is why it sits below the numbers rather than above them.
/// Owns no nutrition logic; [review] is the ported `useOcrReviewState`, so the
/// rescaling and validation are unit-tested in `test/label_review_test.dart`.
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

  late final LabelReviewFields _fields = LabelReviewFields(widget.review);

  @override
  void dispose() {
    _fields.dispose();
    super.dispose();
  }

  void _commitAmount(String value) => setState(
    () => _fields.commitAmount(value),
  );

  void _confirm() {
    if (!widget.review.canConfirm) {
      setState(() => _submitAttempted = true);
      return;
    }
    widget.onConfirm();
  }

  bool _hasError(String key) =>
      _fields.hasError(key, submitAttempted: _submitAttempted);

  @override
  Widget build(BuildContext context) {
    final review = widget.review;
    final micronutrients = labelMicronutrientDefinitions
        .where((d) => review.initialNutrition[d.key] != null)
        .toList();
    final macros = labelMacroDefinitions
        .where((d) => d.key != 'calories')
        .toList();

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Flexible(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(
              NhamSpacing.sp4,
              NhamSpacing.sp3,
              NhamSpacing.sp4,
              NhamSpacing.sp4,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                LabelCalorieHero(
                  controller: _fields.nutrient('calories'),
                  hasError: _hasError('calories'),
                  enabled: !widget.saving,
                  onChanged: (value) =>
                      setState(() => review.setNutrientText('calories', value)),
                ),
                const SizedBox(height: NhamSpacing.sp4),
                LabelMacroRow(
                  definitions: macros,
                  controllerFor: _fields.nutrient,
                  hasError: _hasError,
                  enabled: !widget.saving,
                  onChanged: (key, value) =>
                      setState(() => review.setNutrientText(key, value)),
                ),
                const SizedBox(height: NhamSpacing.sp5),
                const Divider(height: 1, color: NhamColors.border),
                const SizedBox(height: NhamSpacing.sp3),
                LabelProductNameField(
                  controller: _fields.name,
                  isValid: review.productIsValid,
                  enabled: !widget.saving,
                  onChanged: (value) =>
                      setState(() => review.productName = value),
                ),
                const SizedBox(height: NhamSpacing.sp3),
                LabelReviewQuantity(
                  controller: _fields.amount,
                  unitLabel: _fields.unitLabel,
                  isValid: review.amountIsValid,
                  shortcuts: review.shortcuts,
                  currentAmount: review.parsedAmount,
                  enabled: !widget.saving,
                  onChanged: (value) =>
                      setState(() => review.amountText = value),
                  onCommit: _commitAmount,
                ),
                if (review.label != null) ...[
                  const SizedBox(height: NhamSpacing.sp2),
                  LabelReviewMetadata(label: review.label!),
                ],
                if (micronutrients.isNotEmpty) ...[
                  const SizedBox(height: NhamSpacing.sp2),
                  LabelMicronutrients(
                    definitions: micronutrients,
                    controllerFor: _fields.nutrient,
                    hasError: _hasError,
                    enabled: !widget.saving,
                    onChanged: (key, value) =>
                        setState(() => review.setNutrientText(key, value)),
                  ),
                ],
                if (widget.errorText != null) ...[
                  const SizedBox(height: NhamSpacing.sp3),
                  Text(
                    widget.errorText!,
                    style: dashMeta(color: NhamColors.danger),
                  ),
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
}
