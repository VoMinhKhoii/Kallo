import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../models/nutrition_label.dart';
import '../../../../shared/widgets/nham_text.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import '../../logic/label_review.dart';
const _basisKeys = {
  LabelBasis.per100g: 'per100g',
  LabelBasis.per100ml: 'per100ml',
  LabelBasis.perServing: 'perServing',
  LabelBasis.perContainer: 'perContainer',
  LabelBasis.per100gAndServing: 'per100gAndServing',
  LabelBasis.per100mlAndServing: 'per100mlAndServing',
};

/// What the scan says the numbers mean, and how sure it is.
///
/// Port of `components/logging/input/ocr-review-metadata.tsx`. A medium or low
/// confidence is the reason the review step exists at all, so it is stated
/// plainly rather than hidden.
class LabelReviewMetadata extends StatelessWidget {
  const LabelReviewMetadata({super.key, required this.label});

  final NutritionLabel label;

  @override
  Widget build(BuildContext context) {
    final rows = <(String, String)>[
      (
        'logging.labelScan.basisLabel'.tr(),
        'logging.labelScan.basis.${_basisKeys[label.basis]}'.tr(),
      ),
      (
        'logging.labelScan.confidenceLabel'.tr(),
        'logging.labelScan.confidence.${label.confidence.name}'.tr(),
      ),
      if (label.servingSizeDescription != null)
        ('logging.labelScan.servingLabel'.tr(), label.servingSizeDescription!),
      if (label.servingsPerContainer != null)
        (
          'logging.labelScan.servingsPerContainerLabel'.tr(),
          formatLabelNumber(label.servingsPerContainer!),
        ),
    ];

    return Container(
      padding: const EdgeInsets.all(NhamSpacing.sp3),
      decoration: BoxDecoration(
        color: NhamColors.track,
        borderRadius: BorderRadius.circular(NhamRadii.containerLg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final (name, value) in rows)
            Padding(
              padding: const EdgeInsets.only(bottom: 2),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  NhamText(
                    name,
                    variant: NhamTextVariant.small,
                    style: const TextStyle(color: NhamColors.textMuted),
                  ),
                  const SizedBox(width: NhamSpacing.sp2),
                  Expanded(
                    child: NhamText(
                      value,
                      variant: NhamTextVariant.small,
                      textAlign: TextAlign.end,
                      style: const TextStyle(color: NhamColors.text),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
