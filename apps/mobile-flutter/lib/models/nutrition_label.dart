/// Nutrition-label OCR model.
///
/// Mirrors `ParsedNutritionLabel` on the web (`lib/nutrition/ocr-schema.ts`),
/// as returned by `POST /api/v1/nutrition-label/scan`. A nutrient value of
/// null means "not printed on the label" (≠ zero), so scaling must preserve
/// nulls exactly as the web review step does.
library;

/// The 28 nutrient keys, in the web's `OCR_NUTRIENT_KEYS` order. Wire names —
/// the same strings appear in the scan response and the log request.
const List<String> labelNutrientKeys = [
  'calories',
  'proteinGrams',
  'carbsGrams',
  'fatGrams',
  'fiberGrams',
  'sodiumMg',
  'calciumMg',
  'ironMg',
  'magnesiumMg',
  'phosphorusMg',
  'potassiumMg',
  'zincMg',
  'copperMcg',
  'manganeseMg',
  'betaCaroteneMcg',
  'vitaminAMcg',
  'vitaminCMg',
  'vitaminDMcg',
  'vitaminEMg',
  'vitaminKMcg',
  'vitaminB1Mg',
  'vitaminB2Mg',
  'vitaminPpMg',
  'vitaminB5Mg',
  'vitaminB6Mg',
  'vitaminB9Mcg',
  'vitaminB12Mcg',
  'vitaminHMcg',
];

/// The four the review step refuses to submit without.
const List<String> requiredLabelNutrientKeys = [
  'calories',
  'proteinGrams',
  'carbsGrams',
  'fatGrams',
];

/// Which column of the printed table the numbers belong to.
enum LabelBasis {
  per100g('per_100g'),
  per100ml('per_100ml'),
  perServing('per_serving'),
  perContainer('per_container'),
  per100gAndServing('per_100g_and_serving'),
  per100mlAndServing('per_100ml_and_serving');

  const LabelBasis(this.wire);

  /// The `basis` discriminator as the server spells it.
  final String wire;

  static LabelBasis fromWire(String? value) => LabelBasis.values.firstWhere(
    (basis) => basis.wire == value,
    // A basis we don't know is treated as per-serving: the review step then
    // asks for an amount in servings, which is always answerable.
    orElse: () => LabelBasis.perServing,
  );
}

/// How sure the model is about what it read. Drives the review-step warning.
enum LabelConfidence {
  high,
  medium,
  low;

  static LabelConfidence fromWire(String? value) => switch (value) {
    'high' => LabelConfidence.high,
    'medium' => LabelConfidence.medium,
    _ => LabelConfidence.low,
  };
}

/// A printed quantity: serving size or net content. Unit is 'g' or 'ml'.
class LabelMeasure {
  const LabelMeasure({required this.value, required this.unit});

  final double value;
  final String unit;

  static LabelMeasure? fromJson(Object? json) {
    if (json is! Map<String, dynamic>) return null;
    final value = (json['value'] as num?)?.toDouble();
    final unit = json['unit'] as String?;
    if (value == null || value <= 0 || unit == null) return null;
    if (unit != 'g' && unit != 'ml') return null;
    return LabelMeasure(value: value, unit: unit);
  }
}

/// One column of nutrient values, keyed by [labelNutrientKeys]. Absent and
/// explicitly-null keys both read as null.
typedef LabelNutrients = Map<String, double?>;

LabelNutrients _nutrientsFromJson(Object? json) {
  final map = json is Map<String, dynamic> ? json : const <String, dynamic>{};
  return {
    for (final key in labelNutrientKeys) key: (map[key] as num?)?.toDouble(),
  };
}

class NutritionLabel {
  const NutritionLabel({
    required this.basis,
    required this.confidence,
    required this.labelEvidence,
    this.productName,
    this.servingSize,
    this.servingSizeDescription,
    this.servingsPerContainer,
    this.netContent,
    this.per100g,
    this.per100ml,
    this.perServing,
    this.perContainer,
  });

  final LabelBasis basis;
  final LabelConfidence confidence;

  /// Short text transcribed from the label's heading — evidence that a real
  /// nutrition table was read, shown nowhere but useful when debugging.
  final String labelEvidence;

  final String? productName;
  final LabelMeasure? servingSize;
  final String? servingSizeDescription;
  final double? servingsPerContainer;

  /// Present only on the `per_container` basis.
  final LabelMeasure? netContent;

  final LabelNutrients? per100g;
  final LabelNutrients? per100ml;
  final LabelNutrients? perServing;
  final LabelNutrients? perContainer;

  factory NutritionLabel.fromJson(Map<String, dynamic> json) {
    final basis = LabelBasis.fromWire(json['basis'] as String?);
    return NutritionLabel(
      basis: basis,
      confidence: LabelConfidence.fromWire(json['confidence'] as String?),
      labelEvidence: json['labelEvidence'] as String? ?? '',
      productName: json['productName'] as String?,
      servingSize: LabelMeasure.fromJson(json['servingSize']),
      servingSizeDescription: json['servingSizeDescription'] as String?,
      servingsPerContainer: (json['servingsPerContainer'] as num?)?.toDouble(),
      netContent: LabelMeasure.fromJson(json['netContent']),
      per100g: json.containsKey('per100g')
          ? _nutrientsFromJson(json['per100g'])
          : null,
      per100ml: json.containsKey('per100ml')
          ? _nutrientsFromJson(json['per100ml'])
          : null,
      perServing: json.containsKey('perServing')
          ? _nutrientsFromJson(json['perServing'])
          : null,
      perContainer: json.containsKey('perContainer')
          ? _nutrientsFromJson(json['perContainer'])
          : null,
    );
  }
}
