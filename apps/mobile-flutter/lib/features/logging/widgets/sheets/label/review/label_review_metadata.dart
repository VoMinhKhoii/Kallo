import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../../../models/nutrition_label.dart';
import '../../../../../../theme/calm_tokens.dart';

const _basisKeys = {
  LabelBasis.per100g: 'per100g',
  LabelBasis.per100ml: 'per100ml',
  LabelBasis.perServing: 'perServing',
  LabelBasis.perContainer: 'perContainer',
  LabelBasis.per100gAndServing: 'per100gAndServing',
  LabelBasis.per100mlAndServing: 'per100mlAndServing',
};

/// What the scan says the numbers mean — one quiet line, not a table.
///
/// It was four label/value rows in a filled card, which gave provenance more
/// weight than the figures it describes. Confidence is named only when it is
/// not high: "please check these" is worth a line; "we're confident" is the
/// state the user already assumes.
class LabelReviewMetadata extends StatelessWidget {
  const LabelReviewMetadata({super.key, required this.label});

  final NutritionLabel label;

  @override
  Widget build(BuildContext context) {
    final parts = <String>[
      'logging.labelScan.basis.${_basisKeys[label.basis]}'.tr(),
      if (label.servingSizeDescription != null) label.servingSizeDescription!,
      if (label.confidence != LabelConfidence.high)
        'logging.labelScan.confidence.${label.confidence.name}'.tr(),
    ];
    return Text(parts.join(' · '), style: dashMeta());
  }
}
