import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../../models/nutrition/barcode_product.dart';
import '../../../../../theme/kallo_colors.dart';
import '../../../../../theme/kallo_theme.dart';
import '../../../logic/barcode_amount.dart';
import '../../../../../theme/calm_tokens.dart';

/// What the chosen amount comes to: calories in the hero figure, then the
/// three macros scaled off the per-100g panel.
class BarcodeNutritionPreview extends StatelessWidget {
  const BarcodeNutritionPreview({
    super.key,
    required this.product,
    required this.grams,
  });

  final BarcodeProduct product;
  final int grams;

  String _fmt(double? value) => value == null ? '—' : '$value';

  @override
  Widget build(BuildContext context) {
    final calories = scalePer100(product.caloriesKcal, grams, decimals: 0);
    final macros = [
      (
        label: 'logging.barcode.protein'.tr(),
        value: scalePer100(product.proteinG, grams),
      ),
      (
        label: 'logging.barcode.carbs'.tr(),
        value: scalePer100(product.carbohydrateG, grams),
      ),
      (
        label: 'logging.barcode.fat'.tr(),
        value: scalePer100(product.fatG, grams),
      ),
    ];

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(KalloSpacing.sp3),
      decoration: BoxDecoration(
        color: KalloColors.elev,
        borderRadius: BorderRadius.circular(KalloRadii.containerLg),
        border: Border.all(color: KalloColors.borderSoft),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'logging.barcode.nutritionForAmount'.tr(
              namedArgs: {'grams': '$grams'},
            ),
            style: kGroupLabel(),
          ),
          const SizedBox(height: KalloSpacing.sp2),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                calories == null ? '—' : '${calories.round()}',
                style: dashHero(),
              ),
              const SizedBox(width: 4),
              Text('logging.manualLogging.kcal'.tr(), style: dashMeta()),
            ],
          ),
          const SizedBox(height: KalloSpacing.sp2),
          Row(
            children: [
              for (final macro in macros)
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(macro.label, style: dashMeta()),
                      const SizedBox(height: 2),
                      Text(
                        macro.value == null ? '—' : '${_fmt(macro.value)}g',
                        style: dashValue(),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
