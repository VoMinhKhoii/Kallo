/// Pure amount/portion math for the barcode quantity step.
///
/// Port of the web's `components/logging/input/barcode-product-step.tsx`
/// constants and scaling, kept widget-free so it is unit-testable and the
/// sheet stays thin.
library;

import 'dart:math' as math;

import '../../../models/barcode_product.dart';

/// Shared cap so a large-but-valid package (OFF allows up to 100kg) is never
/// silently clipped when resolved in serving/package mode. Mirrors
/// `MAX_FOOD_ITEM_GRAMS` in `lib/barcode/constants.ts`.
const int maxFoodItemGrams = 100000;
const int maxServings = 99;
const int gramStep = 50;
const List<int> quickGramOptions = [50, 100, 150, 200, 250];

/// How the user picks an amount: by stated serving, whole package, or custom
/// grams. Only the modes the product actually has sizing for are offered;
/// grams is always available as the fallback.
enum BarcodeAmountMode { serving, package, grams }

/// Available modes in priority order (matches the web: serving first when
/// present, then package, grams always last).
List<BarcodeAmountMode> availableModes(BarcodeProduct product) => [
  if (product.servingSizeG != null) BarcodeAmountMode.serving,
  if (product.packageSizeG != null) BarcodeAmountMode.package,
  BarcodeAmountMode.grams,
];

int clampGrams(num grams) => grams.round().clamp(1, maxFoodItemGrams);

int clampServings(num servings) => servings.round().clamp(1, maxServings);

/// Initial value for the custom-grams field: one serving, else the package,
/// else 100g.
int defaultCustomGrams(BarcodeProduct product) =>
    clampGrams(product.servingSizeG ?? product.packageSizeG ?? 100);

/// The gram amount the current selection resolves to. Serving/package modes
/// fall through to custom grams when the product lacks that sizing (can only
/// happen if state and product get out of sync — same guard as the web).
int resolveGrams({
  required BarcodeAmountMode mode,
  required int servings,
  required int customGrams,
  required BarcodeProduct product,
}) {
  final servingSizeG = product.servingSizeG;
  final packageSizeG = product.packageSizeG;
  if (mode == BarcodeAmountMode.serving && servingSizeG != null) {
    return clampGrams(servings * servingSizeG);
  }
  if (mode == BarcodeAmountMode.package && packageSizeG != null) {
    return clampGrams(packageSizeG);
  }
  return clampGrams(customGrams);
}

/// Scale a per-100g nutrient to [grams]. Calories round to whole numbers
/// (`decimals: 0`), macros to one decimal, matching the source data's
/// precision. Null passes through — unknown is not zero.
double? scalePer100(double? per100, int grams, {int decimals = 1}) {
  if (per100 == null) return null;
  final value = per100 * grams / 100;
  if (decimals == 0) return value.roundToDouble();
  final factor = math.pow(10, decimals).toDouble();
  return (value * factor).round() / factor;
}
