/// Barcode-product model.
///
/// Mirrors `ParsedBarcodeProduct` on the web (`lib/domain/barcode/types.ts`),
/// as returned by `GET /api/v1/barcode/search`. All nutrition values are per
/// 100 of [amountUnit] (100 g, or 100 ml for a drink); null means unknown
/// (≠ zero), so scaling must preserve nulls.
library;

class BarcodeProduct {
  final String barcode;
  final String name;
  final String? brand;

  final double? caloriesKcal;
  final double? proteinG;
  final double? carbohydrateG;
  final double? fatG;

  /// Premium: null for an account without micronutrient access.
  final double? fiberG;

  /// Premium: null for an account without micronutrient access.
  final double? sodiumMg;

  /// Amount per stated serving, in [amountUnit], when the provider has it.
  /// Validated server-side (positive, ≤ 100kg).
  final double? servingSizeG;

  /// Amount in the whole package, in [amountUnit], when the provider has it.
  final double? packageSizeG;

  /// `'g'`, or `'ml'` for a drink labelled per 100 ml. Sizes, the logged
  /// amount and the per-100 values are all in it. Older servers send nothing,
  /// which reads as grams.
  final String amountUnit;

  /// Path of the product photo on OUR API (never a third-party URL), or null.
  final String? imageUrl;

  /// The label's other nutrients per 100, keyed like the web's
  /// `NutritionValues` (`calciumMg`, `vitaminDMcg`, …). Premium: null for an
  /// account without access — the server strips it, and the meal still keeps
  /// them when logged.
  final Map<String, double>? micronutrients;

  const BarcodeProduct({
    required this.barcode,
    required this.name,
    required this.brand,
    this.caloriesKcal,
    this.proteinG,
    this.carbohydrateG,
    this.fatG,
    this.fiberG,
    this.sodiumMg,
    this.servingSizeG,
    this.packageSizeG,
    this.amountUnit = 'g',
    this.imageUrl,
    this.micronutrients,
  });

  factory BarcodeProduct.fromJson(Map<String, dynamic> json) => BarcodeProduct(
    barcode: json['barcode'] as String? ?? '',
    name: json['name'] as String? ?? '',
    brand: json['brand'] as String?,
    caloriesKcal: (json['caloriesKcal'] as num?)?.toDouble(),
    proteinG: (json['proteinG'] as num?)?.toDouble(),
    carbohydrateG: (json['carbohydrateG'] as num?)?.toDouble(),
    fatG: (json['fatG'] as num?)?.toDouble(),
    fiberG: (json['fiberG'] as num?)?.toDouble(),
    sodiumMg: (json['sodiumMg'] as num?)?.toDouble(),
    servingSizeG: (json['servingSizeG'] as num?)?.toDouble(),
    packageSizeG: (json['packageSizeG'] as num?)?.toDouble(),
    amountUnit: json['amountUnit'] == 'ml' ? 'ml' : 'g',
    imageUrl: json['imageUrl'] as String?,
    micronutrients: _parseMicronutrients(json['micronutrients']),
  );

  static Map<String, double>? _parseMicronutrients(Object? raw) {
    if (raw is! Map) return null;
    return {
      for (final entry in raw.entries)
        if (entry.value is num)
          entry.key as String: (entry.value as num).toDouble(),
    };
  }
}
