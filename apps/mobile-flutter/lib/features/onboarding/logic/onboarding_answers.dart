/// The wizard's live answers and the three server payloads built from them.
///
/// Mutable on purpose: six screens edit one object and the wizard re-renders,
/// so the step-2 map has exactly one author. Every enum-shaped answer is held
/// as its ENUM, not as the string the server spells it with — parsing happens
/// once at the seed boundary ([buildOnboardingAnswers]), serialising once in
/// the payloads below, so the schema is not written out in four places.
library;

import '../../../models/profile/onboarding.dart';
import '../../../shared/logic/tdee.dart';
import '../data/screen_two_values.dart';

/// Inclusive validation ranges, mirroring the body-metrics zod schema.
const ({num min, num max}) kWeightRange = (min: 30, max: 300);
const ({num min, num max}) kHeightRange = (min: 100, max: 250);
const ({num min, num max}) kAgeRange = (min: 13, max: 100);

/// The lowest daily target that may be shown or stored. Mirrors
/// `settings/logic/profile_payload.dart` and the server's
/// `calorieTarget = max(., 500)`; without it an IN-RANGE 30 kg / 100 cm /
/// 100 yr sedentary cut computes a NEGATIVE target, and the server clamps only
/// the calories, so the negative macro grams would be stored as sent.
const double kCalorieFloor = 500;

class OnboardingAnswers {
  OnboardingAnswers({
    required this.preferredLocale,
    required this.countryOfOrigin,
    required this.countryOfResidence,
    required this.biologicalSex,
    required this.weightKg,
    required this.heightCm,
    required this.age,
    required this.activityLevel,
    required this.goal,
    required this.aggression,
    required this.carbSplit,
    required this.deficitOverride,
    required this.cooking,
  });

  String preferredLocale;
  String? countryOfOrigin;
  String? countryOfResidence;

  BiologicalSex? biologicalSex;
  double? weightKg;
  int? heightCm;
  int? age;
  ActivityLevel activityLevel;
  Goal goal;
  double? aggression;
  CarbSplit carbSplit;
  double? deficitOverride;
  CookingHabits cooking;

  // ── Validation ──────────────────────────────────────────────────────────
  // A BLANK field is not an error — screen 6 offers the unlock card instead of
  // a number. Only a value OUT OF RANGE blocks Continue: it cannot be stored.

  bool _outOfRange(num? value, ({num min, num max}) range) =>
      value != null && (value < range.min || value > range.max);

  bool get weightOutOfRange => _outOfRange(weightKg, kWeightRange);
  bool get heightOutOfRange => _outOfRange(heightCm, kHeightRange);
  bool get ageOutOfRange => _outOfRange(age, kAgeRange);

  bool get metricsValid =>
      !weightOutOfRange && !heightOutOfRange && !ageOutOfRange;

  /// Every field the TDEE maths needs is present AND in range.
  bool get hasTargets =>
      metricsValid &&
      biologicalSex != null &&
      weightKg != null &&
      heightCm != null &&
      age != null;

  // ── Derived targets ─────────────────────────────────────────────────────

  int? get tdeeKcal {
    if (!hasTargets) return null;
    final bmr = calcBMR(
      biologicalSex: biologicalSex!,
      weightKg: weightKg!,
      heightCm: heightCm!,
      age: age!,
    );
    return calcTDEE(bmr, activityLevel);
  }

  /// The card's figures AND the payload's, from one computation, so the card
  /// can never show a number the save would have clamped.
  MacroTargets? get targets {
    final tdee = tdeeKcal;
    if (tdee == null) return null;
    final raw = calcDailyTargets(
      tdee,
      goal,
      aggression,
      carbSplit,
      deficitOverride,
    );
    if (raw.calories >= kCalorieFloor) return raw;
    // Clamp then RE-DERIVE the grams, or the three macro figures no longer
    // add up to the number above them.
    return calcMacroGrams(kCalorieFloor, carbSplit);
  }

  /// kcal added or removed per day at the current goal + pace — the number the
  /// pace ruler reads out. Zero while maintaining.
  int get paceKcal =>
      goal == Goal.maintaining
          ? 0
          : (deficitOverride ?? (aggression ?? 0) * kAggressionKcalPerKg)
              .round();

  // ── Server payloads ─────────────────────────────────────────────────────

  /// Server step 1 — screens 1 and 2.
  Map<String, dynamic> get stepOnePayload => {
    'countryOfOrigin': countryOfOrigin,
    'countryOfResidence': countryOfResidence,
    'preferredLocale': preferredLocale,
  };

  /// Server step 2 — screens 3, 4 and 6. `null` until the metrics are
  /// complete: the payload's targets are non-nullable.
  ScreenTwoValues? get stepTwoValues {
    final tdee = tdeeKcal;
    final macros = targets;
    if (tdee == null || macros == null) return null;
    return ScreenTwoValues(
      biologicalSex: biologicalSex!.name,
      weightKg: weightKg!,
      heightCm: heightCm!,
      age: age!,
      activityLevel: activityLevelToString(activityLevel),
      goal: goal.name,
      // Web parity (`lib/domain/onboarding/types.ts`): a maintaining plan has
      // no pace, so it stores none rather than a stale one from a former goal.
      aggression: goal == Goal.maintaining ? null : aggression,
      carbSplit: carbSplitToString(carbSplit),
      deficitOverride: deficitOverride,
      tdeeKcal: tdee,
      calorieTarget: macros.calories.round(),
      proteinTargetG: macros.proteinG.round(),
      carbsTargetG: macros.carbsG.round(),
      fatTargetG: macros.fatG.round(),
    );
  }

  /// Server step 3 — screen 5.
  Map<String, dynamic> get stepThreePayload => cooking.toJson();
}
