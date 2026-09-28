/// One food the scan sheet shows, whatever it came from — a barcode product,
/// a read nutrition label, or one typed by hand ("Enter manually").
///
/// Values are held PER BASIS ("per 100 ml", "per serving"), separate from the
/// amount being logged: the result card scales them to the chosen amount,
/// the editor edits them against the basis, and a save scales once. The keys
/// are the label log's wire keys ([labelNutrientKeys]); null means the label
/// doesn't list it — unknown, never 0.
library;

import '../../../../models/nutrition/barcode_product.dart';
import '../../../../models/nutrition_label.dart';
import '../label/review.dart';

enum ScanFoodSource { barcode, label, manual }

class ScanFood {
  const ScanFood({
    required this.name,
    required this.unit,
    required this.basisAmount,
    required this.values,
    required this.source,
    this.brand,
    this.servingSize,
    this.packageSize,
    this.barcode,
    this.edited = false,
    this.confidence,
  });

  /// A barcode product: per 100 of its unit, sized by its serving and pack.
  factory ScanFood.fromBarcode(BarcodeProduct product) => ScanFood(
    name: product.name,
    brand: product.brand,
    unit: product.amountUnit,
    basisAmount: 100,
    source: ScanFoodSource.barcode,
    barcode: product.barcode,
    servingSize: product.servingSizeG,
    packageSize: product.packageSizeG,
    values: {
      for (final key in labelNutrientKeys) key: null,
      'calories': product.caloriesKcal,
      'proteinGrams': product.proteinG,
      'carbsGrams': product.carbohydrateG,
      'fatGrams': product.fatG,
      'fiberGrams': product.fiberG,
      'sodiumMg': product.sodiumMg,
      ...?product.micronutrients,
    },
  );

  /// A read label: the column its numbers belong to ([reviewColumnFor]), sized
  /// by the serving and pack the label prints.
  factory ScanFood.fromLabel(
    NutritionLabel label, {
    required String fallbackName,
  }) {
    final column = reviewColumnFor(label);
    final shortcuts = shortcutsFor(label, column.unit);
    final printed = label.productName?.trim();
    return ScanFood(
      name: (printed?.isNotEmpty ?? false) ? printed! : fallbackName,
      unit: column.unit,
      basisAmount: column.referenceAmount,
      source: ScanFoodSource.label,
      servingSize: shortcuts.servingAmount,
      packageSize: shortcuts.packageAmount,
      confidence: label.confidence,
      values: {for (final key in labelNutrientKeys) key: column.values[key]},
    );
  }

  /// "Enter manually": nothing known yet, per 100 g until the user says
  /// otherwise.
  factory ScanFood.blank() => ScanFood(
    name: '',
    unit: 'g',
    basisAmount: 100,
    source: ScanFoodSource.manual,
    values: {for (final key in labelNutrientKeys) key: null},
  );

  final String name;
  final String? brand;

  /// "g", "ml" or "serving".
  final String unit;

  /// The amount [values] are for, in [unit] — 100 for "per 100 ml".
  final double basisAmount;

  final LabelNutrients values;
  final ScanFoodSource source;

  /// One serving / one pack, in [unit]; null when the source doesn't say.
  final double? servingSize;
  final double? packageSize;

  /// The product's barcode — set for a barcode product only.
  final String? barcode;

  /// True once the user changed anything in the editor. An unedited barcode
  /// product logs by its barcode (the server re-resolves the shared row); an
  /// edited one logs the user's own numbers through the label path.
  final bool edited;

  final LabelConfidence? confidence;

  /// Logs by barcode: a product the user hasn't changed.
  bool get logsByBarcode => barcode != null && !edited;

  /// [key]'s value for [amount] (in [unit]); null stays null.
  double? valueFor(String key, double amount) {
    final perBasis = values[key];
    if (perBasis == null || basisAmount <= 0) return null;
    return perBasis * amount / basisAmount;
  }

  /// Every nutrient scaled to [amount], rounded to two decimals as the label
  /// log expects. Nulls are kept.
  LabelNutrients nutritionFor(double amount) => {
    for (final key in labelNutrientKeys)
      key: switch (valueFor(key, amount)) {
        final v? => (v * 100).round() / 100,
        null => null,
      },
  };

  /// The four the log refuses to save without are all known.
  bool get hasRequired =>
      requiredLabelNutrientKeys.every((key) => values[key] != null);

  ScanFood copyWith({
    String? name,
    String? unit,
    double? basisAmount,
    LabelNutrients? values,
    bool? edited,
  }) => ScanFood(
    name: name ?? this.name,
    brand: brand,
    unit: unit ?? this.unit,
    basisAmount: basisAmount ?? this.basisAmount,
    values: values ?? this.values,
    source: source,
    // A new unit makes the old serving / pack sizes meaningless.
    servingSize: unit == null || unit == this.unit ? servingSize : null,
    packageSize: unit == null || unit == this.unit ? packageSize : null,
    barcode: barcode,
    edited: edited ?? this.edited,
    confidence: confidence,
  );
}
