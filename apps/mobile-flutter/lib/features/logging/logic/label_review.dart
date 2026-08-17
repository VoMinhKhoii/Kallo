/// Review state for a scanned nutrition label: which column of the printed
/// table to show, how the amount rescales every nutrient, and whether the
/// result is submittable.
///
/// Port of `components/logging/input/use-ocr-review-state.ts`. Kept
/// widget-free (like `barcode_amount.dart`) so the rescale arithmetic is
/// unit-testable and the review sheet stays thin.
library;

import '../../../models/nutrition_label.dart';
import 'label_nutrients.dart';

/// Same ceiling the server's `logNutritionLabelMealSchema` enforces.
const double maxLabelAmount = 100000;

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
  final servingAmount = serving?.unit == unit
      ? serving?.value
      : (unit == 'serving' ? 1.0 : null);

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

/// Mutable review state. The sheet holds one of these and calls into it; every
/// derived value below is recomputed from the current text, exactly as the
/// React hook recomputed on each render.
class LabelReviewState {
  LabelReviewState(this.label, {required String defaultProductName})
    : _column = reviewColumnFor(label),
      productName = (label?.productName?.trim().isNotEmpty ?? false)
          ? label!.productName!.trim()
          : defaultProductName {
    _appliedAmount = _column.referenceAmount;
    amountText = formatLabelNumber(_column.referenceAmount);
    for (final key in labelNutrientKeys) {
      final value = _column.values[key];
      _nutrientTexts[key] = value == null ? '' : formatLabelNumber(value);
    }
  }

  final NutritionLabel? label;
  final LabelReviewColumn _column;
  final Map<String, String> _nutrientTexts = {};

  String productName;
  late String amountText;

  /// The amount the CURRENT nutrient texts correspond to. Committing a new
  /// amount rescales the texts and moves this with them, so scaling is never
  /// applied twice.
  late double _appliedAmount;

  /// The values as first read off the label — decides which micronutrient
  /// rows are worth showing at all.
  LabelNutrients get initialNutrition => _column.values;

  String get unit => _column.unit;

  LabelAmountShortcuts get shortcuts => shortcutsFor(label, unit);

  String? get servingDescription => label?.servingSizeDescription;
  double? get servingsPerContainer => label?.servingsPerContainer;

  double? get parsedAmount => parseLabelDecimal(amountText);

  bool get amountIsValid {
    final amount = parsedAmount;
    return amount != null && amount > 0 && amount <= maxLabelAmount;
  }

  bool get productIsValid {
    final trimmed = productName.trim();
    return trimmed.isNotEmpty && trimmed.length <= 200;
  }

  double get _amountScale =>
      amountIsValid ? parsedAmount! / _appliedAmount : 1;

  String nutrientText(String key) => _nutrientTexts[key] ?? '';

  void setNutrientText(String key, String value) {
    _nutrientTexts[key] = value;
  }

  /// The value that will be submitted for [key] — the typed figure scaled to
  /// the pending amount, rounded to two decimals like the web.
  double? nutrientValue(String key) {
    final parsed = parseLabelDecimal(nutrientText(key));
    if (parsed == null) return null;
    return (parsed * _amountScale * 100).round() / 100;
  }

  /// True when the field has text that either doesn't parse or lands outside
  /// the nutrient's supported range.
  bool nutrientHasError(String key) {
    final text = nutrientText(key);
    if (text.trim().isEmpty) return false;
    final parsed = parseLabelDecimal(text);
    if (parsed == null) return true;
    final maximum = labelNutrientsByKey[key]?.maximum;
    final scaled = nutrientValue(key);
    return maximum != null && scaled != null && scaled > maximum;
  }

  /// Every nutrient keyed for the log request. Nulls are kept: unknown is not
  /// zero.
  LabelNutrients get nutrition => {
    for (final key in labelNutrientKeys) key: nutrientValue(key),
  };

  bool get canConfirm {
    if (!amountIsValid || !productIsValid) return false;
    for (final key in labelNutrientKeys) {
      if (nutrientHasError(key)) return false;
    }
    for (final key in requiredLabelNutrientKeys) {
      if (nutrientValue(key) == null) return false;
    }
    return true;
  }

  /// Apply a new amount: rescale every nutrient text by the change, then move
  /// the reference so the next commit scales from here. Invalid input is
  /// ignored (the field keeps the user's text and shows its error).
  void commitAmount([String? nextText]) {
    final text = nextText ?? amountText;
    final nextAmount = parseLabelDecimal(text);
    if (nextAmount == null || nextAmount <= 0 || nextAmount > maxLabelAmount) {
      return;
    }
    final scale = nextAmount / _appliedAmount;
    for (final key in labelNutrientKeys) {
      final value = parseLabelDecimal(nutrientText(key));
      _nutrientTexts[key] = value == null
          ? ''
          : formatLabelNumber(value * scale);
    }
    _appliedAmount = nextAmount;
    amountText = formatLabelNumber(nextAmount);
  }
}
