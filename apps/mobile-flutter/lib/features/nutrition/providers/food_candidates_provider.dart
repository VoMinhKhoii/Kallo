/// Riverpod port of the RN `useFoodCandidates` hook
/// (`apps/mobile/src/lib/nutrition/hooks/use-food-candidates.ts`).
///
/// Mirrors the web `FoodChipRow` query: key `['nutrition','candidates',
/// supported]`, `retry:false`, disabled when the nutrient is unsupported.
///
/// The catalog is STATIC per nutrient but the screen fans out one query per
/// spotlight/detail card, so each nutrient is fetched at most once per session
/// (`staleTime`/`gcTime: Infinity`). We replicate that with `ref.keepAlive()`
/// so the family entry never auto-disposes and is never refetched.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/api_client.dart';
import '../../../models/nutrition.dart';
import '../logic/candidate_nutrients.dart';
import 'candidates_response.dart';

/// Family keyed by the nutrient. Returns `null` when the nutrient is not a
/// supported candidate (parity with the RN `enabled: supported !== null` gate —
/// the widget renders nothing in that case).
final foodCandidatesProvider = FutureProvider.family<CandidatesResponse?,
    NutritionNutrientKey>((ref, nutrient) async {
  final supported = asSupported(nutrient);
  if (supported == null) {
    // Disabled query — never fetches (RN `enabled: false`).
    return null;
  }

  // gcTime: Infinity — keep the resolved catalog for the whole session.
  ref.keepAlive();

  final api = ref.read(apiClientProvider);
  // retry:false in RN — surface failures immediately.
  final json = await api.post<Map<String, dynamic>>(
    '/api/v1/nutrition/candidates',
    {'nutrient': supported},
  );
  return CandidatesResponse.fromJson(json);
});
