/// How the meal edit sheet writes its figures.
library;

import 'package:intl/intl.dart';

/// A multiplier with at most one decimal, in the locale's own mark:
/// `1×`, `1.5×` in en, `1,5×` in vi.
String formatTimes(double value, String locale) {
  final f =
      NumberFormat.decimalPattern(locale)
        ..minimumFractionDigits = 0
        ..maximumFractionDigits = 1;
  return '${f.format(value)}×';
}

/// Whole grams or millilitres, grouped: `1,250 g`, `350 ml`.
String formatAmount(double grams, String unit, String locale) =>
    '${NumberFormat.decimalPattern(locale).format(grams.round())} $unit';
