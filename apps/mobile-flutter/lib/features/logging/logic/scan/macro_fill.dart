/// The four figures a log requires are not independent: energy is 4 kcal per
/// gram of protein and of carbs, 9 per gram of fat (the Atwater factors). Given
/// any three, the fourth follows.
library;

/// kcal per gram, by wire key.
const Map<String, double> _kcalPerGram = {
  'proteinGrams': 4,
  'carbsGrams': 4,
  'fatGrams': 9,
};

/// The one required figure [values] lacks, worked out from the other three —
/// or null when not exactly one is missing, or the other three cannot add up
/// (macros that already hold more energy than the calories given).
///
/// Calories come back whole, grams to one decimal, as a label prints them.
({String key, double value})? fillMissingMacro(Map<String, double?> values) {
  const keys = ['calories', 'proteinGrams', 'carbsGrams', 'fatGrams'];
  final missing = [
    for (final k in keys)
      if (values[k] == null) k,
  ];
  if (missing.length != 1) return null;
  final key = missing.single;
  final double value;
  if (key == 'calories') {
    value = _kcalPerGram.entries.fold(
      0.0,
      (sum, e) => sum + e.value * values[e.key]!,
    );
  } else {
    final others = _kcalPerGram.entries
        .where((e) => e.key != key)
        .fold(0.0, (sum, e) => sum + e.value * values[e.key]!);
    value = (values['calories']! - others) / _kcalPerGram[key]!;
  }
  if (value < 0) return null;
  return (
    key: key,
    value:
        key == 'calories'
            ? value.roundToDouble()
            : (value * 10).roundToDouble() / 10,
  );
}
