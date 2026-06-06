/// The supported food-source-candidate nutrients, vendored as consts from web
/// `lib/nutrition/catalog/nutrients.ts` (keep in sync). Only the candidate
/// gating is needed on mobile.
///
/// Ported from `apps/mobile/src/lib/nutrition/logic/candidate-nutrients.ts`.
library;

import '../../../models/nutrition.dart';

/// The supported candidate nutrient enum names, as raw strings (matching the
/// REST contract's `SupportedCandidateNutrient`).
const List<String> kSupportedCandidateNutrients = [
  'calciumMg',
  'ironMg',
  'vitaminCMg',
  'phosphorusMg',
  'vitaminB1Mg',
  'vitaminB2Mg',
  'vitaminPpMg',
  'vitaminAMcg',
];

final Set<String> _supportedSet = kSupportedCandidateNutrients.toSet();

/// Narrows a nutrient key to a supported candidate nutrient string, or null.
String? asSupported(NutritionNutrientKey nutrient) {
  final name = nutrient.name;
  return _supportedSet.contains(name) ? name : null;
}
