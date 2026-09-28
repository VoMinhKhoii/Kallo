import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/widgets.dart';

import '../../../../../../shared/widgets/sheet/kallo_sheet_sub_header.dart';
import '../../../../logic/label/nutrients.dart';
import '../../../../logic/scan/amount.dart';
import '../../../../logic/scan/captions.dart';
import '../../../../logic/scan/food.dart';
import '../panel/panel.dart';
import 'header.dart';
import 'other_nutrients.dart';

/// The result's second level, a page of its own in the scan sheet so going
/// in and out of it travels like any other level: the same header on top,
/// then the nutrients for the chosen amount.
class ScanOthersPanel extends StatelessWidget {
  const ScanOthersPanel({
    super.key,
    required this.food,
    required this.amount,
    required this.onBack,
    required this.onClose,
  });

  final ScanFood food;
  final ScanAmount amount;

  /// Back to the result.
  final VoidCallback onBack;

  /// A drag down closes the whole sheet, as on any sheet with a pushed level;
  /// null while saving.
  final VoidCallback? onClose;

  @override
  Widget build(BuildContext context) {
    final resolved = amount.resolve(food);
    return ScanPanel(
      // One level above a plain result, as the dense result: the product and
      // its macros stay on top, the frozen photo still shows above.
      height: ScanPanelHeight.dense,
      onDismiss: onClose,
      onBack: onBack,
      header: KalloSheetSubHeader(
        title: 'logging.scan.otherNutrients'.tr(),
        onBack: onBack,
      ),
      body: ScanOtherNutrientsPage(
        header: ScanResultHeader(
          name: food.name,
          subtitle: scanFoodSubtitle(food),
          kcal: food.valueFor('calories', resolved),
          protein: food.valueFor('proteinGrams', resolved),
          carbs: food.valueFor('carbsGrams', resolved),
          fat: food.valueFor('fatGrams', resolved),
        ),
        caption: scanAmountCaption(food, amount, resolved),
        rows: [
          for (final d in labelMicronutrientDefinitions)
            if (food.valueFor(d.key, resolved) case final value?)
              ScanNutrientRow(
                label: 'logging.labelScan.nutrients.${d.labelKey}'.tr(),
                value: (value * 10).round() / 10,
                unit: d.unit,
              ),
        ],
      ),
    );
  }
}
