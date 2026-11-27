/// How the meal edit sheet writes its figures.
library;

import 'package:intl/intl.dart';

import '../serving_ladder.dart';

/// A multiplier along the serving ladder, in the locale's own mark:
/// `0.25×`, `1/3×`, `0.5×`, `1×`, `1.5×` in en; `0,25×`, `1/3×`, `1,5×` in vi.
String formatTimes(double value, String locale) =>
    formatServingTimes(value, locale);

/// Grams or millilitres, grouped: `1,250 g`, `350 ml`. Under 10 keeps up to
/// one decimal (`2.5 g`) so a small dish scaled down never reads `0 g`.
String formatAmount(double grams, String unit, String locale) {
  if (grams < 10) {
    final f = NumberFormat.decimalPattern(locale)
      ..minimumFractionDigits = 0
      ..maximumFractionDigits = 1;
    return '${f.format((grams * 10).round() / 10)} $unit';
  }
  return '${NumberFormat.decimalPattern(locale).format(grams.round())} $unit';
}
