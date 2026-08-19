/// The nutrient rows the label review step renders, and the bounds it
/// validates against.
///
/// Port of `components/logging/input/ocr-review-nutrients.ts` (row order,
/// label key, unit) fused with the per-nutrient maximums from
/// `nutritionValuesSchema` in `lib/nutrition/ocr-schema.ts` — one table
/// instead of two that could drift. The server re-validates all of it; these
/// bounds only exist so a typo is caught before the round trip.
library;

class LabelNutrientDefinition {
  const LabelNutrientDefinition({
    required this.key,
    required this.labelKey,
    required this.unit,
    required this.maximum,
  });

  /// Wire key, one of `labelNutrientKeys`.
  final String key;

  /// Suffix for `logging.labelScan.nutrients.<labelKey>`.
  final String labelKey;

  /// Unit shown beside the field — never converted, only displayed.
  final String unit;

  /// Inclusive upper bound, matching the server schema.
  final double maximum;
}

/// Calories and the three macros — always shown, always required.
const List<LabelNutrientDefinition> labelMacroDefinitions = [
  LabelNutrientDefinition(
    key: 'calories',
    labelKey: 'calories',
    unit: 'kcal',
    maximum: 20000,
  ),
  LabelNutrientDefinition(
    key: 'proteinGrams',
    labelKey: 'protein',
    unit: 'g',
    maximum: 5000,
  ),
  LabelNutrientDefinition(
    key: 'carbsGrams',
    labelKey: 'carbohydrates',
    unit: 'g',
    maximum: 5000,
  ),
  LabelNutrientDefinition(
    key: 'fatGrams',
    labelKey: 'fat',
    unit: 'g',
    maximum: 5000,
  ),
];

/// Shown only for the nutrients the scan actually returned a value for —
/// matching the web's filter on `initialNutrition[key] !== null`.
const List<LabelNutrientDefinition> labelMicronutrientDefinitions = [
  LabelNutrientDefinition(
    key: 'fiberGrams',
    labelKey: 'fiber',
    unit: 'g',
    maximum: 2000,
  ),
  LabelNutrientDefinition(
    key: 'sodiumMg',
    labelKey: 'sodium',
    unit: 'mg',
    maximum: 50000,
  ),
  LabelNutrientDefinition(
    key: 'calciumMg',
    labelKey: 'calcium',
    unit: 'mg',
    maximum: 20000,
  ),
  LabelNutrientDefinition(
    key: 'ironMg',
    labelKey: 'iron',
    unit: 'mg',
    maximum: 1000,
  ),
  LabelNutrientDefinition(
    key: 'magnesiumMg',
    labelKey: 'magnesium',
    unit: 'mg',
    maximum: 20000,
  ),
  LabelNutrientDefinition(
    key: 'phosphorusMg',
    labelKey: 'phosphorus',
    unit: 'mg',
    maximum: 20000,
  ),
  LabelNutrientDefinition(
    key: 'potassiumMg',
    labelKey: 'potassium',
    unit: 'mg',
    maximum: 30000,
  ),
  LabelNutrientDefinition(
    key: 'zincMg',
    labelKey: 'zinc',
    unit: 'mg',
    maximum: 1000,
  ),
  LabelNutrientDefinition(
    key: 'copperMcg',
    labelKey: 'copper',
    unit: 'mcg',
    maximum: 1000000,
  ),
  LabelNutrientDefinition(
    key: 'manganeseMg',
    labelKey: 'manganese',
    unit: 'mg',
    maximum: 1000,
  ),
  LabelNutrientDefinition(
    key: 'betaCaroteneMcg',
    labelKey: 'betaCarotene',
    unit: 'mcg',
    maximum: 1000000,
  ),
  LabelNutrientDefinition(
    key: 'vitaminAMcg',
    labelKey: 'vitaminA',
    unit: 'mcg',
    maximum: 100000,
  ),
  LabelNutrientDefinition(
    key: 'vitaminCMg',
    labelKey: 'vitaminC',
    unit: 'mg',
    maximum: 20000,
  ),
  LabelNutrientDefinition(
    key: 'vitaminDMcg',
    labelKey: 'vitaminD',
    unit: 'mcg',
    maximum: 10000,
  ),
  LabelNutrientDefinition(
    key: 'vitaminEMg',
    labelKey: 'vitaminE',
    unit: 'mg',
    maximum: 10000,
  ),
  LabelNutrientDefinition(
    key: 'vitaminKMcg',
    labelKey: 'vitaminK',
    unit: 'mcg',
    maximum: 1000000,
  ),
  LabelNutrientDefinition(
    key: 'vitaminB1Mg',
    labelKey: 'vitaminB1',
    unit: 'mg',
    maximum: 1000,
  ),
  LabelNutrientDefinition(
    key: 'vitaminB2Mg',
    labelKey: 'vitaminB2',
    unit: 'mg',
    maximum: 1000,
  ),
  LabelNutrientDefinition(
    key: 'vitaminPpMg',
    labelKey: 'vitaminPp',
    unit: 'mg',
    maximum: 5000,
  ),
  LabelNutrientDefinition(
    key: 'vitaminB5Mg',
    labelKey: 'vitaminB5',
    unit: 'mg',
    maximum: 1000,
  ),
  LabelNutrientDefinition(
    key: 'vitaminB6Mg',
    labelKey: 'vitaminB6',
    unit: 'mg',
    maximum: 1000,
  ),
  LabelNutrientDefinition(
    key: 'vitaminB9Mcg',
    labelKey: 'vitaminB9',
    unit: 'mcg',
    maximum: 1000000,
  ),
  LabelNutrientDefinition(
    key: 'vitaminB12Mcg',
    labelKey: 'vitaminB12',
    unit: 'mcg',
    maximum: 1000000,
  ),
  LabelNutrientDefinition(
    key: 'vitaminHMcg',
    labelKey: 'vitaminH',
    unit: 'mcg',
    maximum: 1000000,
  ),
];

/// Every row, macros first — the same order as `labelNutrientKeys`.
final Map<String, LabelNutrientDefinition> labelNutrientsByKey = {
  for (final definition in [
    ...labelMacroDefinitions,
    ...labelMicronutrientDefinitions,
  ])
    definition.key: definition,
};
