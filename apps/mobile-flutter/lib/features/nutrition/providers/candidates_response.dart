/// Food suggestions for a nutrient, derived from the food-composition table.
///
/// Ported from the web `CandidatesResponse` contract: each food carries its
/// Vietnamese + English name and per-100g amount of the requested nutrient.
library;

class FoodCandidate {
  final String id;
  final String name; // Vietnamese (namePrimary)
  final String nameEn;
  final double amount; // per-100g of the nutrient
  final String unit;

  const FoodCandidate({
    required this.id,
    required this.name,
    required this.nameEn,
    required this.amount,
    required this.unit,
  });

  factory FoodCandidate.fromJson(Map<String, dynamic> json) => FoodCandidate(
        id: json['id'] as String,
        name: json['name'] as String,
        nameEn: json['nameEn'] as String,
        amount: (json['amount'] as num?)?.toDouble() ?? 0,
        unit: json['unit'] as String,
      );
}

class CandidatesResponse {
  final String nutrient;
  final List<FoodCandidate> foods;

  const CandidatesResponse({required this.nutrient, required this.foods});

  factory CandidatesResponse.fromJson(Map<String, dynamic> json) =>
      CandidatesResponse(
        nutrient: json['nutrient'] as String,
        foods: (json['foods'] as List<dynamic>)
            .map((e) => FoodCandidate.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}
