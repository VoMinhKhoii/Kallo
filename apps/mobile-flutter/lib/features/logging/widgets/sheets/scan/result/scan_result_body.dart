import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../../../models/nutrition_label.dart';
import '../../../../../../shared/widgets/list/grouped_list_card.dart';
import '../../../../../../shared/widgets/list/list_row.dart';
import '../../../../../../theme/calm_tokens.dart';
import '../../../../logic/scan/scan_amount.dart';
import '../../../../logic/scan/scan_food.dart';
import 'scan_amount_card.dart';
import 'scan_amount_field.dart';
import 'scan_amount_stepper.dart';
import 'scan_cup_ruler.dart';
import 'scan_result_header.dart';

/// A scan result's content — the same for a barcode product, a read label and
/// a food typed by hand: the header, the Portion / Amount card (with the cup
/// ruler for a drink's custom amount) and, when the food carries them, the row
/// into its other nutrients.
class ScanResultBody extends StatelessWidget {
  const ScanResultBody({
    super.key,
    required this.food,
    required this.amount,
    required this.onAmount,
    required this.onOtherNutrients,
    this.subtitle,
    this.enabled = true,
  });

  final ScanFood food;
  final ScanAmount amount;
  final ValueChanged<ScanAmount> onAmount;

  /// Opens the other nutrients; the row shows only when the food lists any
  /// (a free account's product carries none).
  final VoidCallback onOtherNutrients;

  /// The brand, or "From the label".
  final String? subtitle;

  /// False while saving.
  final bool enabled;

  /// Whether [food] lists anything beyond calories and the three macros.
  static bool hasOtherNutrients(ScanFood food) => food.values.entries.any(
    (e) => e.value != null && !requiredLabelNutrientKeys.contains(e.key),
  );

  @override
  Widget build(BuildContext context) {
    final resolved = amount.resolve(food);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ScanResultHeader(
          name: food.name,
          subtitle: subtitle,
          kcal: food.valueFor('calories', resolved),
          protein: food.valueFor('proteinGrams', resolved),
          carbs: food.valueFor('carbsGrams', resolved),
          fat: food.valueFor('fatGrams', resolved),
        ),
        const SizedBox(height: 16),
        ScanAmountCard(
          choices: [for (final p in portionsFor(food)) _choice(p)],
          selected: amount.portion,
          onSelect:
              enabled ? (p) => onAmount(amount.withPortion(p, food)) : null,
          amount: ScanAmountStepper(
            onDecrease:
                enabled && amount.canStep(food, -1)
                    ? () => onAmount(amount.stepped(food, -1))
                    : null,
            onIncrease:
                enabled && amount.canStep(food, 1)
                    ? () => onAmount(amount.stepped(food, 1))
                    : null,
            child: _amountValue(),
          ),
          ruler:
              amount.portion == ScanPortion.custom && food.unit == 'ml'
                  ? ScanCupRuler(
                    ml: amount.custom.round(),
                    enabled: enabled,
                    onChanged:
                        (ml) => onAmount(amount.withCustom(ml.toDouble())),
                  )
                  : null,
        ),
        if (hasOtherNutrients(food)) ...[
          const SizedBox(height: 12),
          GroupedListCard(
            separatorInset: 0,
            children: [
              ListRow(
                label: 'logging.scan.otherNutrients'.tr(),
                showChevron: true,
                onTap: enabled ? onOtherNutrients : null,
              ),
            ],
          ),
        ],
      ],
    );
  }

  ScanPortionChoice _choice(ScanPortion portion) {
    final unit = food.unit;
    return switch (portion) {
      ScanPortion.serving => ScanPortionChoice(
        value: portion,
        label: 'logging.scan.portionServing'.tr(),
        detail:
            unit == 'serving' || food.servingSize == null
                ? null
                : formatSize(food.servingSize!, unit),
        display:
            unit == 'serving' || food.servingSize == null
                ? 'logging.scan.portionServing'.tr()
                : 'logging.scan.perServing'.tr(
                  namedArgs: {'size': formatSize(food.servingSize!, unit)},
                ),
      ),
      ScanPortion.pack => ScanPortionChoice(
        value: portion,
        label: 'logging.scan.portionPack'.tr(),
        detail:
            food.packageSize == null || unit == 'serving'
                ? null
                : formatSize(food.packageSize!, unit),
        display: 'logging.scan.portionPack'.tr(),
      ),
      ScanPortion.custom => ScanPortionChoice(
        value: portion,
        label: 'logging.scan.portionCustom'.tr(),
        display: 'logging.scan.portionCustom'.tr(),
      ),
    };
  }

  /// "1 serving", "2 packs", or the typed "250 ml".
  Widget _amountValue() {
    Widget count(int n, String wordKey) => Text.rich(
      TextSpan(
        children: [
          TextSpan(text: '$n', style: dashValue()),
          TextSpan(text: ' ${wordKey.plural(n)}', style: dashMeta()),
        ],
      ),
    );
    return switch (amount.portion) {
      ScanPortion.serving => count(amount.servings, 'logging.scan.servingWord'),
      ScanPortion.pack => count(amount.packs, 'logging.scan.packWord'),
      ScanPortion.custom =>
        food.unit == 'serving'
            ? count(amount.custom.round(), 'logging.scan.servingWord')
            : ScanAmountField(
              amount: amount.custom.round(),
              unit: food.unit,
              enabled: enabled,
              onChanged:
                  (value) => onAmount(amount.withCustom(value.toDouble())),
            ),
    };
  }
}
