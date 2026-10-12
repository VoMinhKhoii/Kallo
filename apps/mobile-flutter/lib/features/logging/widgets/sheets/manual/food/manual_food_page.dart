import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../../../models/nutrition/ingredient.dart';
import '../../../../../../shared/widgets/sheet/kallo_sheet_header.dart';
import '../../../../../../shared/widgets/surface/kallo_button.dart';
import '../../../../../../theme/calm_tokens.dart';
import '../../../../../../theme/kallo_theme.dart';
import '../../../../data/manual_log_providers.dart';
import '../../scan/result/header.dart';
import 'manual_amount_card.dart';

/// One food, weighed before it goes in (approved canvas, E4): the scan
/// result's header — name, hero calories for the amount, the English name and
/// the calorie-share bar — over the amount card, with "Add to meal" (or
/// "Update" for a food already in it) docked under them.
class ManualFoodPage extends StatelessWidget {
  const ManualFoodPage({
    super.key,
    required this.food,
    required this.grams,
    required this.inMeal,
    required this.onGrams,
    required this.onCommit,
    this.onBack,
    this.onRemove,
    this.mealFull = false,
  });

  final IngredientSearchResult food;
  final double grams;

  /// The food is already in the meal: commit updates it, and it can be removed.
  final bool inMeal;
  final ValueChanged<double> onGrams;
  final VoidCallback onCommit;

  /// Back to the results; null when the page was opened from the meal itself,
  /// where the leading control closes the sheet instead.
  final VoidCallback? onBack;
  final VoidCallback? onRemove;

  /// The meal already holds as many foods as it may: a new one cannot go in,
  /// and the page says so over the disabled button.
  final bool mealFull;

  @override
  Widget build(BuildContext context) {
    final macros = food.per100g.scaledTo(grams);
    final blocked = mealFull && !inMeal;
    final bottomInset = math.max(
      MediaQuery.viewPaddingOf(context).bottom,
      KalloSpacing.sp4,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        KalloSheetHeader(
          title: 'logging.manualLogging.sheetTitle'.tr(),
          onBack: onBack,
        ),
        Expanded(
          child: SingleChildScrollView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ScanResultHeader(
                  name: food.namePrimary,
                  subtitle: food.englishName,
                  kcal: macros.caloriesKcal,
                  protein: macros.proteinG,
                  carbs: macros.carbohydrateG,
                  fat: macros.fatG,
                ),
                const SizedBox(height: KalloSpacing.sp5),
                ManualAmountCard(food: food, grams: grams, onGrams: onGrams),
              ],
            ),
          ),
        ),
        const SizedBox(height: KalloSpacing.sp2),
        if (blocked) ...[
          Text(
            'logging.manualLogging.mealFull'.tr(
              namedArgs: {'count': '$maxManualItems'},
            ),
            textAlign: TextAlign.center,
            style: dashMeta(),
          ),
          const SizedBox(height: KalloSpacing.sp2),
        ],
        KalloButton(
          title:
              (inMeal
                      ? 'logging.manualLogging.update'
                      : 'logging.manualLogging.addToMeal')
                  .tr(),
          disabled: blocked,
          onPressed: onCommit,
        ),
        if (inMeal && onRemove != null)
          KalloButton(
            title: 'logging.manualLogging.remove'.tr(),
            variant: KalloButtonVariant.danger,
            onPressed: onRemove,
          ),
        SizedBox(height: bottomInset),
      ],
    );
  }
}
