/// Food suggestions for a nutrient, keyed by the nutrient.
///
/// Now DB-derived (top foods by per-100g density) and available for ANY card
/// nutrient — no fixed supported set. Each nutrient is fetched at most once per
/// session (`ref.keepAlive()`), returning a pool the sheet pages through, so the
/// "don't have these?" refresh is instant (no extra round-trip).
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/api_client.dart';
import '../../../models/nutrition.dart';
import 'candidates_response.dart';

final foodCandidatesProvider =
    FutureProvider.family<CandidatesResponse, NutritionNutrientKey>(
        (ref, nutrient) async {
  // Keep the resolved pool for the whole session (gcTime: Infinity).
  ref.keepAlive();

  final api = ref.read(apiClientProvider);
  final json = await api.post<Map<String, dynamic>>(
    '/api/v1/nutrition/candidates',
    {'nutrient': nutrient.name},
  );
  return CandidatesResponse.fromJson(json);
});
