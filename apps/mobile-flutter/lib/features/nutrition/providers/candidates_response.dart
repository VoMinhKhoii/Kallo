/// Render-ready food-source candidate models for the nutrition surface.
///
/// Ported from `lib/api/contracts/nutrition.ts` (`CandidatesResponse`,
/// `FoodSourceCandidate`). i18n-key-only — every user-facing string is a
/// translation key resolved at render time.
library;

class FoodSourceCandidate {
  final String nutrient;
  final String id;
  final String nameKey;
  final String servingKey;
  final String rationaleKey;
  final String? cautionKey;

  const FoodSourceCandidate({
    required this.nutrient,
    required this.id,
    required this.nameKey,
    required this.servingKey,
    required this.rationaleKey,
    this.cautionKey,
  });

  factory FoodSourceCandidate.fromJson(Map<String, dynamic> json) =>
      FoodSourceCandidate(
        nutrient: json['nutrient'] as String,
        id: json['id'] as String,
        nameKey: json['nameKey'] as String,
        servingKey: json['servingKey'] as String,
        rationaleKey: json['rationaleKey'] as String,
        cautionKey: json['cautionKey'] as String?,
      );
}

class CandidatesResponse {
  final String nutrient;
  final List<FoodSourceCandidate> candidates;

  const CandidatesResponse({required this.nutrient, required this.candidates});

  factory CandidatesResponse.fromJson(Map<String, dynamic> json) =>
      CandidatesResponse(
        nutrient: json['nutrient'] as String,
        candidates: (json['candidates'] as List<dynamic>)
            .map((e) => FoodSourceCandidate.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}
