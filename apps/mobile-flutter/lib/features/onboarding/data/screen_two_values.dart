/// The server's step-2 payload, byte-compatible with the RN/web
/// `POST /api/v1/onboarding/screen` body (mirrors RN `ScreenOneData`).
///
/// Three wizard screens feed it — About you (3), Goal (4) and Daily target (6)
/// — so it outlived the single screen that used to own it and moved here.
library;

class ScreenTwoValues {
  final String biologicalSex; // 'male' | 'female'
  final double weightKg;
  final int heightCm;
  final int age;
  final String activityLevel;
  final String goal;
  final double? aggression;
  final String carbSplit;
  final double? deficitOverride;
  final int tdeeKcal;
  final int calorieTarget;
  final int proteinTargetG;
  final int carbsTargetG;
  final int fatTargetG;

  const ScreenTwoValues({
    required this.biologicalSex,
    required this.weightKg,
    required this.heightCm,
    required this.age,
    required this.activityLevel,
    required this.goal,
    required this.aggression,
    required this.carbSplit,
    required this.deficitOverride,
    required this.tdeeKcal,
    required this.calorieTarget,
    required this.proteinTargetG,
    required this.carbsTargetG,
    required this.fatTargetG,
  });

  Map<String, dynamic> toJson() => {
        'biologicalSex': biologicalSex,
        'weightKg': weightKg,
        'heightCm': heightCm,
        'age': age,
        'activityLevel': activityLevel,
        'goal': goal,
        'aggression': aggression,
        'carbSplit': carbSplit,
        'deficitOverride': deficitOverride,
        'tdeeKcal': tdeeKcal,
        'calorieTarget': calorieTarget,
        'proteinTargetG': proteinTargetG,
        'carbsTargetG': carbsTargetG,
        'fatTargetG': fatTargetG,
      };
}
