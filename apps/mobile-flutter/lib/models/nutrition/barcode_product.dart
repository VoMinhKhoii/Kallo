/// Barcode-product model.
///
/// Mirrors `ParsedBarcodeProduct` on the web (`lib/barcode/openfoodfacts.ts`),
/// as returned by `GET /api/v1/barcode/search`. All nutrition values are
/// per-100g; null means unknown (≠ zero), so scaling must preserve nulls.
library;

class BarcodeProduct {
  final String barcode;
  final String name;
  final String? brand;

  final double? caloriesKcal;
  final double? proteinG;
  final double? carbohydrateG;
  final double? fatG;
  final double? fiberG;
  final double? sodiumMg;

  /// Grams per stated serving, when Open Food Facts has it. Validated
  /// server-side (positive, ≤ 100kg).
  final double? servingSizeG;

  /// Grams per whole package, when Open Food Facts has it.
  final double? packageSizeG;

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
  );
}
