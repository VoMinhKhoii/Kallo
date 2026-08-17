/// Onboarding-related data models.
///
/// Ported from `lib/onboarding/types.ts` and `lib/onboarding/schemas.ts`.
library;

enum BiologicalSex { male, female }

enum ActivityLevel { sedentary, light, moderate, veryActive }

ActivityLevel activityLevelFromString(String s) => switch (s) {
      'sedentary' => ActivityLevel.sedentary,
      'light' => ActivityLevel.light,
      'moderate' => ActivityLevel.moderate,
      'very_active' => ActivityLevel.veryActive,
      _ => throw ArgumentError('Unknown ActivityLevel: $s'),
    };

String activityLevelToString(ActivityLevel a) => switch (a) {
      ActivityLevel.sedentary => 'sedentary',
      ActivityLevel.light => 'light',
      ActivityLevel.moderate => 'moderate',
      ActivityLevel.veryActive => 'very_active',
    };

enum Goal { cutting, bulking, maintaining }

enum CarbSplit { moderateCarb, lowerCarb, higherCarb }

CarbSplit carbSplitFromString(String s) => switch (s) {
      'moderate_carb' => CarbSplit.moderateCarb,
      'lower_carb' => CarbSplit.lowerCarb,
      'higher_carb' => CarbSplit.higherCarb,
      _ => throw ArgumentError('Unknown CarbSplit: $s'),
    };

String carbSplitToString(CarbSplit c) => switch (c) {
      CarbSplit.moderateCarb => 'moderate_carb',
      CarbSplit.lowerCarb => 'lower_carb',
      CarbSplit.higherCarb => 'higher_carb',
    };

enum OilUsage { minimal, normal, heavy }

enum RicePortion { small, medium, large }

enum SugarBraised { low, medium, high }

enum ProteinPortion { small, medium, large }

enum BrothConsumption { leaveIt, some, finishIt }

BrothConsumption brothConsumptionFromString(String s) => switch (s) {
      'leave_it' => BrothConsumption.leaveIt,
      'some' => BrothConsumption.some,
      'finish_it' => BrothConsumption.finishIt,
      _ => throw ArgumentError('Unknown BrothConsumption: $s'),
    };

String brothConsumptionToString(BrothConsumption b) => switch (b) {
      BrothConsumption.leaveIt => 'leave_it',
      BrothConsumption.some => 'some',
      BrothConsumption.finishIt => 'finish_it',
    };

class BodyMetrics {
  final BiologicalSex biologicalSex;
  final double weightKg;
  final int heightCm;
  final int age;
  final ActivityLevel activityLevel;

  const BodyMetrics({
    required this.biologicalSex,
    required this.weightKg,
    required this.heightCm,
    required this.age,
    required this.activityLevel,
  });

  factory BodyMetrics.fromJson(Map<String, dynamic> json) => BodyMetrics(
        biologicalSex:
            BiologicalSex.values.byName(json['biologicalSex'] as String),
        weightKg: (json['weightKg'] as num).toDouble(),
        heightCm: json['heightCm'] as int,
        age: json['age'] as int,
        activityLevel:
            activityLevelFromString(json['activityLevel'] as String),
      );

  Map<String, dynamic> toJson() => {
        'biologicalSex': biologicalSex.name,
        'weightKg': weightKg,
        'heightCm': heightCm,
        'age': age,
        'activityLevel': activityLevelToString(activityLevel),
      };

  BodyMetrics copyWith({
    BiologicalSex? biologicalSex,
    double? weightKg,
    int? heightCm,
    int? age,
    ActivityLevel? activityLevel,
  }) =>
      BodyMetrics(
        biologicalSex: biologicalSex ?? this.biologicalSex,
        weightKg: weightKg ?? this.weightKg,
        heightCm: heightCm ?? this.heightCm,
        age: age ?? this.age,
        activityLevel: activityLevel ?? this.activityLevel,
      );
}

class CookingHabits {
  final OilUsage oilUsage;
  final RicePortion defaultRicePortion;
  final SugarBraised sugarBraised;
  final ProteinPortion defaultProteinPortion;
  final BrothConsumption brothConsumption;

  const CookingHabits({
    required this.oilUsage,
    required this.defaultRicePortion,
    required this.sugarBraised,
    required this.defaultProteinPortion,
    required this.brothConsumption,
  });

  factory CookingHabits.fromJson(Map<String, dynamic> json) => CookingHabits(
        oilUsage: OilUsage.values.byName(json['oilUsage'] as String),
        defaultRicePortion:
            RicePortion.values.byName(json['defaultRicePortion'] as String),
        sugarBraised:
            SugarBraised.values.byName(json['sugarBraised'] as String),
        defaultProteinPortion: ProteinPortion.values
            .byName(json['defaultProteinPortion'] as String),
        brothConsumption:
            brothConsumptionFromString(json['brothConsumption'] as String),
      );

  Map<String, dynamic> toJson() => {
        'oilUsage': oilUsage.name,
        'defaultRicePortion': defaultRicePortion.name,
        'sugarBraised': sugarBraised.name,
        'defaultProteinPortion': defaultProteinPortion.name,
        'brothConsumption': brothConsumptionToString(brothConsumption),
      };

  CookingHabits copyWith({
    OilUsage? oilUsage,
    RicePortion? defaultRicePortion,
    SugarBraised? sugarBraised,
    ProteinPortion? defaultProteinPortion,
    BrothConsumption? brothConsumption,
  }) =>
      CookingHabits(
        oilUsage: oilUsage ?? this.oilUsage,
        defaultRicePortion: defaultRicePortion ?? this.defaultRicePortion,
        sugarBraised: sugarBraised ?? this.sugarBraised,
        defaultProteinPortion:
            defaultProteinPortion ?? this.defaultProteinPortion,
        brothConsumption: brothConsumption ?? this.brothConsumption,
      );
}

class MacroTargets {
  final double calories;
  final double proteinG;
  final double carbsG;
  final double fatG;

  const MacroTargets({
    required this.calories,
    required this.proteinG,
    required this.carbsG,
    required this.fatG,
  });

  factory MacroTargets.fromJson(Map<String, dynamic> json) => MacroTargets(
        calories: (json['calories'] as num).toDouble(),
        proteinG: (json['proteinG'] as num).toDouble(),
        carbsG: (json['carbsG'] as num).toDouble(),
        fatG: (json['fatG'] as num).toDouble(),
      );

  Map<String, dynamic> toJson() => {
        'calories': calories,
        'proteinG': proteinG,
        'carbsG': carbsG,
        'fatG': fatG,
      };

  MacroTargets copyWith({
    double? calories,
    double? proteinG,
    double? carbsG,
    double? fatG,
  }) =>
      MacroTargets(
        calories: calories ?? this.calories,
        proteinG: proteinG ?? this.proteinG,
        carbsG: carbsG ?? this.carbsG,
        fatG: fatG ?? this.fatG,
      );
}

class OnboardingProfile {
  // Screen 1
  final BodyMetrics bodyMetrics;
  final double tdeeKcal;
  final Goal goal;
  final double? aggression; // null for maintaining
  final CarbSplit carbSplit;
  final double? deficitOverride; // transient, not persisted
  final MacroTargets dailyTargets;
  // Screen 2
  final String? countryOfOrigin;
  final String? countryOfResidence;
  // Screen 3
  final CookingHabits cookingHabits;

  const OnboardingProfile({
    required this.bodyMetrics,
    required this.tdeeKcal,
    required this.goal,
    required this.aggression,
    required this.carbSplit,
    required this.deficitOverride,
    required this.dailyTargets,
    required this.countryOfOrigin,
    required this.countryOfResidence,
    required this.cookingHabits,
  });

  factory OnboardingProfile.fromJson(Map<String, dynamic> json) =>
      OnboardingProfile(
        bodyMetrics: BodyMetrics.fromJson(
            json['bodyMetrics'] as Map<String, dynamic>),
        tdeeKcal: (json['tdeeKcal'] as num).toDouble(),
        goal: Goal.values.byName(json['goal'] as String),
        aggression: (json['aggression'] as num?)?.toDouble(),
        carbSplit: carbSplitFromString(json['carbSplit'] as String),
        deficitOverride: (json['deficitOverride'] as num?)?.toDouble(),
        dailyTargets: MacroTargets.fromJson(
            json['dailyTargets'] as Map<String, dynamic>),
        countryOfOrigin: json['countryOfOrigin'] as String?,
        countryOfResidence: json['countryOfResidence'] as String?,
        cookingHabits: CookingHabits.fromJson(
            json['cookingHabits'] as Map<String, dynamic>),
      );

  Map<String, dynamic> toJson() => {
        'bodyMetrics': bodyMetrics.toJson(),
        'tdeeKcal': tdeeKcal,
        'goal': goal.name,
        'aggression': aggression,
        'carbSplit': carbSplitToString(carbSplit),
        'deficitOverride': deficitOverride,
        'dailyTargets': dailyTargets.toJson(),
        'countryOfOrigin': countryOfOrigin,
        'countryOfResidence': countryOfResidence,
        'cookingHabits': cookingHabits.toJson(),
      };

  OnboardingProfile copyWith({
    BodyMetrics? bodyMetrics,
    double? tdeeKcal,
    Goal? goal,
    double? Function()? aggression,
    CarbSplit? carbSplit,
    double? Function()? deficitOverride,
    MacroTargets? dailyTargets,
    String? Function()? countryOfOrigin,
    String? Function()? countryOfResidence,
    CookingHabits? cookingHabits,
  }) =>
      OnboardingProfile(
        bodyMetrics: bodyMetrics ?? this.bodyMetrics,
        tdeeKcal: tdeeKcal ?? this.tdeeKcal,
        goal: goal ?? this.goal,
        aggression:
            aggression != null ? aggression() : this.aggression,
        carbSplit: carbSplit ?? this.carbSplit,
        deficitOverride: deficitOverride != null
            ? deficitOverride()
            : this.deficitOverride,
        dailyTargets: dailyTargets ?? this.dailyTargets,
        countryOfOrigin: countryOfOrigin != null
            ? countryOfOrigin()
            : this.countryOfOrigin,
        countryOfResidence: countryOfResidence != null
            ? countryOfResidence()
            : this.countryOfResidence,
        cookingHabits: cookingHabits ?? this.cookingHabits,
      );
}

/// Input shape for the profile/settings form (PUT /api/v1/profile).
class ProfileSettingsInput {
  final BodyMetrics bodyMetrics;
  final Goal goal;
  final double? aggression;
  final CarbSplit carbSplit;
  final MacroTargets dailyTargets;
  final String? countryOfOrigin;
  final String? countryOfResidence;
  final CookingHabits cookingHabits;

  const ProfileSettingsInput({
    required this.bodyMetrics,
    required this.goal,
    required this.aggression,
    required this.carbSplit,
    required this.dailyTargets,
    required this.countryOfOrigin,
    required this.countryOfResidence,
    required this.cookingHabits,
  });

  Map<String, dynamic> toJson() => {
        'bodyMetrics': bodyMetrics.toJson(),
        'goal': goal.name,
        'aggression': aggression,
        'carbSplit': carbSplitToString(carbSplit),
        'dailyTargets': dailyTargets.toJson(),
        'countryOfOrigin': countryOfOrigin,
        'countryOfResidence': countryOfResidence,
        'cookingHabits': cookingHabits.toJson(),
      };
}
