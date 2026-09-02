/// The two amount modes that need no typing: count the servings, or take the
/// whole package as-is.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';
import '../../../logic/barcode_amount.dart';
import 'barcode_amount_controls.dart';
import '../../../../../theme/calm_tokens.dart';

class BarcodeServingPicker extends StatelessWidget {
  const BarcodeServingPicker({
    super.key,
    required this.servings,
    required this.servingSizeG,
    required this.totalGrams,
    required this.disabled,
    required this.onAdjust,
  });

  final int servings;
  final double servingSizeG;
  final int totalGrams;
  final bool disabled;
  final ValueChanged<int> onAdjust;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            BarcodeStepperButton(
              icon: LucideIcons.minus300,
              label: 'logging.barcode.decreaseServings'.tr(),
              onTap: disabled || servings <= 1 ? null : () => onAdjust(-1),
            ),
            Expanded(
              child: Center(
                child: Text('$servings', style: dashValue()),
              ),
            ),
            BarcodeStepperButton(
              icon: LucideIcons.plus300,
              label: 'logging.barcode.increaseServings'.tr(),
              onTap:
                  disabled || servings >= maxServings
                      ? null
                      : () => onAdjust(1),
            ),
          ],
        ),
        const SizedBox(height: KalloSpacing.sp1),
        Text(
          '${'logging.barcode.perServing'.tr(namedArgs: {'grams': '${servingSizeG.round()}'})} · ${'logging.barcode.totalGrams'.tr(namedArgs: {'grams': '$totalGrams'})}',
          style: dashMeta(tabular: true),
        ),
      ],
    );
  }
}

class BarcodePackageCard extends StatelessWidget {
  const BarcodePackageCard({super.key, required this.packageSizeG});

  final double packageSizeG;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(KalloSpacing.sp3),
      decoration: BoxDecoration(
        color: KalloColors.elev,
        borderRadius: BorderRadius.circular(KalloRadii.lg),
        border: Border.all(color: KalloColors.borderFaint),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'logging.barcode.wholePackage'.tr(),
            style: dashBody(weight: FontWeight.w500),
          ),
          const SizedBox(height: 2),
          Text(
            'logging.barcode.totalGrams'.tr(
              namedArgs: {'grams': '${packageSizeG.round()}'},
            ),
            style: dashMeta(tabular: true),
          ),
        ],
      ),
    );
  }
}
