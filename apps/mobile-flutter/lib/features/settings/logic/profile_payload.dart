import '../data/profile_providers.dart';
import '../widgets/profile_form_values.dart';
import 'tdee.dart';

/// Builds the flat `PUT /api/v1/profile` payload from the current form values,
/// recomputing TDEE + targets exactly as the web `handleSave` does. Shared by
/// every focused settings editor (the numeric goal editor and the
/// instant-commit cooking / region editors) so each persists the SAME contract.
///
/// Requires complete body metrics — callers gate on a non-null profile and a
/// passing [validateBodyMetrics] before instant-committing.
ProfileSavePayload buildProfilePayload(
  ProfileFormValues v,
  String preferredLocale,
) {
  final bmr = calcBMR(
    biologicalSex: v.biologicalSex,
    weightKg: v.weightKg!,
    heightCm: v.heightCm!,
    age: v.age!,
  );
  final tdee = calcTDEE(bmr, v.activityLevel);
  final targets = calcDailyTargets(tdee, v.goal, v.aggression, v.carbSplit);
  final clampedCalories = targets.calories < 500 ? 500.0 : targets.calories;
  final macros = calcMacroGrams(clampedCalories, v.carbSplit);

  return ProfileSavePayload(
    weightKg: v.weightKg!,
    heightCm: v.heightCm!,
    age: v.age!,
    biologicalSex: v.biologicalSex,
    activityLevel: v.activityLevel,
    tdeeKcal: tdee,
    goal: v.goal,
    aggression: v.aggression,
    carbSplit: v.carbSplit,
    calorieTarget: clampedCalories.round(),
    proteinTargetG: macros.proteinG.round(),
    carbsTargetG: macros.carbsG.round(),
    fatTargetG: macros.fatG.round(),
    countryOfOrigin: v.countryOfOrigin,
    countryOfResidence: v.countryOfResidence,
    preferredLocale: preferredLocale,
    oilUsage: v.oilUsage,
    defaultRicePortion: v.defaultRicePortion,
    sugarBraised: v.sugarBraised,
    defaultProteinPortion: v.defaultProteinPortion,
    brothConsumption: v.brothConsumption,
  );
}
