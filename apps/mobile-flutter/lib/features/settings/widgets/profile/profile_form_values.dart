import 'package:easy_localization/easy_localization.dart';

import '../../../../models/profile/onboarding.dart';
import '../../data/profile_providers.dart';

/// Mutable form state for the settings profile editor.
///
/// Mirrors the RN `ProfileFormValues` (react-hook-form). Numeric fields are
/// nullable because the user can clear an input mid-edit; validation guards the
/// save. `weightKg` is nullable (the DecimalInput reports `null` while empty).
class ProfileFormValues {
  /// Null until the user has actually chosen — never silently defaulted to
  /// male, which would bake a wrong BMR into the saved targets.
  BiologicalSex? biologicalSex;
  double? weightKg;
  int? heightCm;
  int? age;
  ActivityLevel activityLevel;
  Goal goal;
  double? aggression;
  CarbSplit carbSplit;
  String? countryOfOrigin;
  String? countryOfResidence;
  OilUsage oilUsage;
  RicePortion defaultRicePortion;
  SugarBraised sugarBraised;
  ProteinPortion defaultProteinPortion;
  BrothConsumption brothConsumption;

  ProfileFormValues({
    required this.biologicalSex,
    required this.weightKg,
    required this.heightCm,
    required this.age,
    required this.activityLevel,
    required this.goal,
    required this.aggression,
    required this.carbSplit,
    required this.countryOfOrigin,
    required this.countryOfResidence,
    required this.oilUsage,
    required this.defaultRicePortion,
    required this.sugarBraised,
    required this.defaultProteinPortion,
    required this.brothConsumption,
  });

  ProfileFormValues clone() => ProfileFormValues(
        biologicalSex: biologicalSex,
        weightKg: weightKg,
        heightCm: heightCm,
        age: age,
        activityLevel: activityLevel,
        goal: goal,
        aggression: aggression,
        carbSplit: carbSplit,
        countryOfOrigin: countryOfOrigin,
        countryOfResidence: countryOfResidence,
        oilUsage: oilUsage,
        defaultRicePortion: defaultRicePortion,
        sugarBraised: sugarBraised,
        defaultProteinPortion: defaultProteinPortion,
        brothConsumption: brothConsumption,
      );

  bool equalsTo(ProfileFormValues o) =>
      biologicalSex == o.biologicalSex &&
      weightKg == o.weightKg &&
      heightCm == o.heightCm &&
      age == o.age &&
      activityLevel == o.activityLevel &&
      goal == o.goal &&
      aggression == o.aggression &&
      carbSplit == o.carbSplit &&
      countryOfOrigin == o.countryOfOrigin &&
      countryOfResidence == o.countryOfResidence &&
      oilUsage == o.oilUsage &&
      defaultRicePortion == o.defaultRicePortion &&
      sugarBraised == o.sugarBraised &&
      defaultProteinPortion == o.defaultProteinPortion &&
      brothConsumption == o.brothConsumption;

  /// Builds the initial form values from a loaded [ProfileRow], applying the
  /// SAME fallbacks the RN `defaultValues` memo uses.
  factory ProfileFormValues.fromRow(ProfileRow p) {
    double? parseAggression() {
      final raw = p.aggression;
      if (raw == null || raw.isEmpty) return null;
      return double.tryParse(raw) ?? 0.5;
    }

    return ProfileFormValues(
      // Like the numeric metrics below, sex starts EMPTY when the profile has
      // none — a silent male default would compute a wrong BMR the user never
      // chose. validateBodyMetrics forces a genuine selection instead.
      biologicalSex: _sexFrom(p.biologicalSex),
      // Numeric body metrics start EMPTY when the profile has none — never
      // fabricated 65/165/25, which a user who skipped onboarding could save as
      // if they were real. validateBodyMetrics forces a genuine entry instead.
      weightKg: p.weightKg,
      heightCm: p.heightCm,
      age: p.age,
      activityLevel: _activityFrom(p.activityLevel) ?? ActivityLevel.light,
      goal: _goalFrom(p.goal) ?? Goal.maintaining,
      aggression: parseAggression(),
      carbSplit: _carbFrom(p.carbSplit) ?? CarbSplit.moderateCarb,
      countryOfOrigin: p.countryOfOrigin,
      countryOfResidence: p.countryOfResidence,
      oilUsage: _oilFrom(p.oilUsage) ?? OilUsage.normal,
      defaultRicePortion: _riceFrom(p.defaultRicePortion) ?? RicePortion.medium,
      sugarBraised: _sugarFrom(p.sugarBraised) ?? SugarBraised.medium,
      defaultProteinPortion:
          _proteinFrom(p.defaultProteinPortion) ?? ProteinPortion.medium,
      brothConsumption: _brothFrom(p.brothConsumption) ?? BrothConsumption.some,
    );
  }
}

// ── enum parse helpers (tolerant of null/unknown) ──────────────────────────

BiologicalSex? _sexFrom(String? s) => switch (s) {
      'male' => BiologicalSex.male,
      'female' => BiologicalSex.female,
      _ => null,
    };

ActivityLevel? _activityFrom(String? s) => switch (s) {
      'sedentary' => ActivityLevel.sedentary,
      'light' => ActivityLevel.light,
      'moderate' => ActivityLevel.moderate,
      'very_active' => ActivityLevel.veryActive,
      _ => null,
    };

Goal? _goalFrom(String? s) => switch (s) {
      'cutting' => Goal.cutting,
      'bulking' => Goal.bulking,
      'maintaining' => Goal.maintaining,
      _ => null,
    };

CarbSplit? _carbFrom(String? s) => switch (s) {
      'moderate_carb' => CarbSplit.moderateCarb,
      'lower_carb' => CarbSplit.lowerCarb,
      'higher_carb' => CarbSplit.higherCarb,
      _ => null,
    };

OilUsage? _oilFrom(String? s) => switch (s) {
      'minimal' => OilUsage.minimal,
      'normal' => OilUsage.normal,
      'heavy' => OilUsage.heavy,
      _ => null,
    };

RicePortion? _riceFrom(String? s) => switch (s) {
      'small' => RicePortion.small,
      'medium' => RicePortion.medium,
      'large' => RicePortion.large,
      _ => null,
    };

SugarBraised? _sugarFrom(String? s) => switch (s) {
      'low' => SugarBraised.low,
      'medium' => SugarBraised.medium,
      'high' => SugarBraised.high,
      _ => null,
    };

ProteinPortion? _proteinFrom(String? s) => switch (s) {
      'small' => ProteinPortion.small,
      'medium' => ProteinPortion.medium,
      'large' => ProteinPortion.large,
      _ => null,
    };

BrothConsumption? _brothFrom(String? s) => switch (s) {
      'leave_it' => BrothConsumption.leaveIt,
      'some' => BrothConsumption.some,
      'finish_it' => BrothConsumption.finishIt,
      _ => null,
    };

/// Field identifiers, used to map a validation error to its owning tab.
enum ProfileField { biologicalSex, weightKg, heightCm, age }

/// Validates the body-metrics numeric fields exactly as the RN zod schema does
/// (`createBodyMetricsSchema`). Returns the per-field localized error messages
/// (`validation.bodyMetrics.*`), or an empty map when all valid.
Map<ProfileField, String> validateBodyMetrics(ProfileFormValues v) {
  final errors = <ProfileField, String>{};

  if (v.biologicalSex == null) {
    errors[ProfileField.biologicalSex] =
        tr('validation.bodyMetrics.sexRequired');
  }

  final w = v.weightKg;
  if (w == null || w.isNaN) {
    errors[ProfileField.weightKg] = tr('validation.bodyMetrics.weightRequired');
  } else if (w < 30) {
    errors[ProfileField.weightKg] = tr('validation.bodyMetrics.weightMin');
  } else if (w > 300) {
    errors[ProfileField.weightKg] = tr('validation.bodyMetrics.weightMax');
  }

  final h = v.heightCm;
  if (h == null) {
    errors[ProfileField.heightCm] = tr('validation.bodyMetrics.heightRequired');
  } else if (h < 100) {
    errors[ProfileField.heightCm] = tr('validation.bodyMetrics.heightMin');
  } else if (h > 250) {
    errors[ProfileField.heightCm] = tr('validation.bodyMetrics.heightMax');
  }

  final a = v.age;
  if (a == null) {
    errors[ProfileField.age] = tr('validation.bodyMetrics.ageRequired');
  } else if (a < 13) {
    errors[ProfileField.age] = tr('validation.bodyMetrics.ageMin');
  } else if (a > 100) {
    errors[ProfileField.age] = tr('validation.bodyMetrics.ageMax');
  }

  return errors;
}
