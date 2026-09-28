/// Reading a scanned nutrition label: which column of the printed table its
/// values come from, the serving and pack it states, and the number parsing
/// and formatting the editor shares with the web.
///
/// Port of `components/logging/input/use-ocr-review-state.ts`'s pure half.
/// Widget-free so it is unit-testable.
library;

import '../../../../models/nutrition_label.dart';

/// Parse a user-typed decimal, tolerating the comma separator VN/iOS keyboards
/// emit. Returns null for anything that isn't a plain positive decimal —
/// deliberately stricter than `double.tryParse`, which would accept "1e3",
/// "-5", and "Infinity". Mirrors the web's `parseLocaleDecimal`.
double? parseLabelDecimal(String value) {
  final trimmed = value.trim().replaceAll(RegExp(r'\s'), '');
  if (trimmed.isEmpty) return null;
  if (!RegExp(r'^\d+(?:[.,]\d+)?$').hasMatch(trimmed)) return null;
  final parsed = double.tryParse(trimmed.replaceFirst(',', '.'));
  return (parsed != null && parsed.isFinite) ? parsed : null;
}

/// Render a number the way the web's `formatInputNumber` does: rounded to two
/// decimals, with no trailing ".0" (JS `String(...)` drops it).
String formatLabelNumber(double value) {
  final rounded = (value * 100).round() / 100;
  if (rounded == rounded.roundToDouble()) return rounded.toInt().toString();
  return rounded
      .toString()
      .replaceFirst(RegExp(r'0+$'), '')
      .replaceFirst(RegExp(r'\.$'), '');
}

/// Which column of the label the review step edits, and what one unit of it
/// means. Port of the web's `getReviewColumn`.
class LabelReviewColumn {
  const LabelReviewColumn({
    required this.values,
    required this.referenceAmount,
    required this.unit,
  });

  final LabelNutrients values;

  /// The amount the printed values correspond to (100 for a per-100g label,
  /// the serving size for a per-serving one, …).
  final double referenceAmount;

  /// 'g', 'ml', or 'serving'.
  final String unit;
}

LabelNutrients _emptyNutrients() => {
  for (final key in labelNutrientKeys) key: null,
};

LabelReviewColumn reviewColumnFor(NutritionLabel? label) {
  if (label == null) {
    return LabelReviewColumn(
      values: _emptyNutrients(),
      referenceAmount: 1,
      unit: 'serving',
    );
  }
  switch (label.basis) {
    case LabelBasis.per100g:
      return LabelReviewColumn(
        values: label.per100g ?? _emptyNutrients(),
        referenceAmount: 100,
        unit: 'g',
      );
    case LabelBasis.per100ml:
      return LabelReviewColumn(
        values: label.per100ml ?? _emptyNutrients(),
        referenceAmount: 100,
        unit: 'ml',
      );
    case LabelBasis.perContainer:
      final net = label.netContent;
      return LabelReviewColumn(
        values: label.perContainer ?? _emptyNutrients(),
        referenceAmount: net?.value ?? 1,
        unit: net?.unit ?? 'serving',
      );
    case LabelBasis.perServing:
    case LabelBasis.per100gAndServing:
    case LabelBasis.per100mlAndServing:
      final serving = label.servingSize;
      return LabelReviewColumn(
        values: label.perServing ?? _emptyNutrients(),
        referenceAmount: serving?.value ?? 1,
        unit: serving?.unit ?? 'serving',
      );
  }
}

/// The two one-tap amounts offered above the amount field, when the label
/// carries enough sizing to name them. Port of the web's `getShortcuts`.
class LabelAmountShortcuts {
  const LabelAmountShortcuts({this.servingAmount, this.packageAmount});

  final double? servingAmount;
  final double? packageAmount;
}

LabelAmountShortcuts shortcutsFor(NutritionLabel? label, String unit) {
  final serving = label?.servingSize;
  final servingAmount =
      serving?.unit == unit ? serving?.value : (unit == 'serving' ? 1.0 : null);

  double? packageAmount;
  final net = label?.netContent;
  final perContainer = label?.basis == LabelBasis.perContainer;
  if (perContainer && net != null && net.unit == unit) {
    packageAmount = net.value;
  } else if (servingAmount != null && label?.servingsPerContainer != null) {
    packageAmount = servingAmount * label!.servingsPerContainer!;
  }
  return LabelAmountShortcuts(
    servingAmount: servingAmount,
    packageAmount: packageAmount,
  );
}
