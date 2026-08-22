/// Pure verdict helpers. The headline branch selection stays in the widget (it
/// needs the translator); these are the locale/data-only pieces.
///
/// No live web counterpart: the `verdict-hero.tsx` section these were
/// extracted from was removed in the web nutrition rewrite (commit cdd7a3fa).
library;

import '../../../models/nutrition/nutrition.dart';

/// `resolvedRange` is a raw '7d' | '30d' | '90d' string in the Dart model.
const Map<String, String> kPeriodKeys = {
  '7d': 'verdict.period7d',
  '30d': 'verdict.period30d',
  '90d': 'verdict.period90d',
};

/// Translator shape — matches easy_localization's `tr(key)` call signature.
typedef Translator = String Function(String key);

List<String> takeNames(
  List<NutrientSummaryItem> items,
  Translator tRoot, {
  int limit = 2,
}) {
  return items
      .take(limit)
      .map((item) => tRoot(item.labelKey).toLowerCase())
      .toList();
}

/// Joins names with a locale-aware conjunction. Dart's `intl` has no
/// `ListFormat`, so this mirrors the RN Hermes fallback: English uses an Oxford
/// "and", Vietnamese uses "và"; everything else falls back to a comma join.
String joinNames(List<String> names, String locale) {
  if (names.isEmpty) return '';
  if (names.length == 1) return names.first;
  final conj = locale.startsWith('vi') ? 'và' : 'and';
  if (names.length == 2) return '${names[0]} $conj ${names[1]}';
  final head = names.sublist(0, names.length - 1).join(', ');
  return '$head, $conj ${names.last}';
}
