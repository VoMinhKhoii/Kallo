/// The wizard's live answers and the three server payloads built from them.
///
/// Mutable on purpose: six screens edit one object and the wizard re-renders,
/// rather than each screen owning a slice and reporting it upward the way the
/// three-step wizard did. That old shape is what forced the "screens 3, 4 and 6
/// each rebuild the whole step-2 map" problem into the wizard; here the map has
/// exactly one author.
///
/// Every enum-shaped answer is held as its ENUM, not as the string the server
/// spells it with. The strings used to live here, which meant the enum schema
/// was written out again in the draft validator, in the seed's cooking table
/// and in each screen's option list — four places to keep in step, and a typo
/// in any of them surfaced as a thrown parse deep inside `build`. Parsing
/// happens once, at the seed boundary ([buildOnboardingAnswers]); serialising
/// happens once, in the payloads below.
library;

import '../../../models/profile/onboarding.dart';
import '../../../shared/logic/tdee.dart';
import '../data/screen_two_values.dart';

/// Inclusive validation ranges, mirroring the body-metrics zod schema.
const ({num min, num max}) kWeightRange = (min: 30, max: 300);
const ({num min, num max}) kHeightRange = (min: 100, max: 250);
const ({num min, num max}) kAgeRange = (min: 13, max: 100);

/// The lowest daily target that may be shown or stored.
///
/// Mirrors `settings/logic/profile_payload.dart` and the server, which clamps
/// `calorieTarget = max(., 500)`. Without it an IN-RANGE 30 kg / 100 cm /
/// 100 yr sedentary cut computes a NEGATIVE target — and the server clamps only
/// the calories, so the negative macro grams would have been stored as sent.
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
  // A BLANK field is not an error: the copy calls the metrics optional, and a
  // user who leaves them blank simply gets the "unlock your target" card on
  // screen 6 instead of a number. Only a value OUT OF RANGE blocks Continue,
  // because that one cannot be stored at all.

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

  /// The card's figures AND the payload's, from one computation: the floor is
  /// applied HERE rather than on the way out, so the target card can never show
  /// a number the save would have clamped.
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
    // Clamp then RE-DERIVE the grams: clamping the calories alone would leave
    // three macro figures that do not add up to the number above them.
    return calcMacroGrams(kCalorieFloor, carbSplit);
  }

  /// kcal added or removed per day at the current goal + pace — the number the
  /// pace ruler reads out. Zero while maintaining.
  int get paceKcal => goal == Goal.maintaining
      ? 0
      : (deficitOverride ?? (aggression ?? 0) * kAggressionKcalPerKg).round();

  // ── Server payloads ─────────────────────────────────────────────────────

  /// Server step 1 — screens 1 and 2.
  Map<String, dynamic> get stepOnePayload => {
        'countryOfOrigin': countryOfOrigin,
        'countryOfResidence': countryOfResidence,
        'preferredLocale': preferredLocale,
      };

  /// Server step 2 — screens 3, 4 and 6. `null` until the metrics are complete:
  /// the payload's targets are non-nullable, so there is nothing to post.
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
