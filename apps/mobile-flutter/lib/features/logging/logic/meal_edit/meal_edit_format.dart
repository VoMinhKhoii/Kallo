/// How the meal edit sheet writes its Amount figures.
library;

import 'package:intl/intl.dart';

import '../meal_utils.dart';

/// Grams or millilitres, grouped: `1,250 g`, `350 ml`. Under [minDishGrams]
/// keeps up to one decimal (`2.5 g`) so a small dish scaled down never reads
/// `0 g`.
String formatAmount(double grams, String unit, String locale) {
  if (grams < minDishGrams) {
    final f =
        NumberFormat.decimalPattern(locale)
          ..minimumFractionDigits = 0
          ..maximumFractionDigits = 1;
    return '${f.format((grams * 10).round() / 10)} $unit';
  }
  return '${NumberFormat.decimalPattern(locale).format(grams.round())} $unit';
}
