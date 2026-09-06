/// The wizard's starting answers, from whichever source has them.
///
/// [buildOnboardingAnswers] resolves the precedence ONCE, per FIELD (profile →
/// draft → device/neutral defaults), so no screen has to branch on where a
/// value came from. It is also the ONE place a stored enum string is parsed:
/// every source is untrusted text, so the tolerant `tryParse…` helpers let an
/// unrecognised value fall through to the next source rather than throw inside
/// `build`. Three device facts survive the merge, because the "From your
/// phone" note may appear only on an answer the phone actually guessed.
library;

import '../../../models/profile/onboarding.dart';
import '../../../shared/data/countries.dart';
import '../data/constants.dart';
import '../data/onboarding_draft.dart';
import '../data/profile_row.dart';
import 'onboarding_answers.dart';
import 'region_defaults.dart';

/// What screens 1 and 2 need to know about the phone, and nothing else.
typedef OnboardingDeviceHints =
    ({
      /// The country the phone's region resolves to, `null` for a region Kallo does
      /// not list. Screen 2 notes this row whether or not it is the current pick.
      String? deviceCountry,

      /// `en` / `vi` — what the phone speaks, narrowed to what Kallo ships.
      String deviceLanguage,

      /// The locale is the phone's guess, not a saved answer — the only case where
      /// screen 1 shows the "From your phone" note.
      bool localeFromDevice,
    });

String? _str(Map<String, dynamic>? map, String key) {
  final value = map?[key];
  return value is String && value.isNotEmpty ? value : null;
}

double? _dbl(Map<String, dynamic>? map, String key) {
  final value = map?[key];
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value);
  return null;
}

int? _int(Map<String, dynamic>? map, String key) {
  final value = map?[key];
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value);
  return null;
}

/// Resolve every screen's opening answer. [deviceRegion] / [deviceLanguage]
/// are passed in rather than read here so the merge stays pure.
({OnboardingAnswers answers, OnboardingDeviceHints device})
buildOnboardingAnswers({
  ProfileRow? profile,
  OnboardingDraft? draft,
  required String? deviceRegion,
  required String deviceLanguage,
}) {
  final step1 = draft?.step1;
  final step2 = draft?.step2;
  final step3 = draft?.step3;

  final deviceCountry =
      deviceRegion == null ? null : countryForCode(deviceRegion)?.value;

  final savedLocale =
      profile?.preferredLocale ?? _str(step1, 'preferredLocale');

  final answers = OnboardingAnswers(
    // A saved locale always wins: the phone's guess is only ever the FIRST
    // answer, never a correction of one the user already gave.
    preferredLocale:
        supportedLocaleOrNull(savedLocale) ??
        supportedLocaleOrNull(deviceLanguage) ??
        kDefaultLocale,
    countryOfOrigin:
        profile?.countryOfOrigin ??
        _str(step1, 'countryOfOrigin') ??
        deviceCountry,
    countryOfResidence:
        profile?.countryOfResidence ??
        _str(step1, 'countryOfResidence') ??
        deviceCountry,
    biologicalSex:
        tryParseBiologicalSex(profile?.biologicalSex) ??
        tryParseBiologicalSex(_str(step2, 'biologicalSex')),
    weightKg: profile?.weightKg ?? _dbl(step2, 'weightKg'),
    heightCm: profile?.heightCm ?? _int(step2, 'heightCm'),
    age: profile?.age ?? _int(step2, 'age'),
    activityLevel:
        tryParseActivityLevel(profile?.activityLevel) ??
        tryParseActivityLevel(_str(step2, 'activityLevel')) ??
        WizardDefaults.activityLevel,
    goal:
        tryParseGoal(profile?.goal) ??
        tryParseGoal(_str(step2, 'goal')) ??
        WizardDefaults.goal,
    // The profile stores aggression as a numeric STRING; a NaN there falls back
    // to the wizard default rather than poisoning the pace ruler.
    aggression:
        double.tryParse(profile?.aggression ?? '') ??
        _dbl(step2, 'aggression') ??
        WizardDefaults.aggression,
    carbSplit:
        tryParseCarbSplit(profile?.carbSplit) ??
        tryParseCarbSplit(_str(step2, 'carbSplit')) ??
        WizardDefaults.carbSplit,
    // Persisted by this server (transient on the web) and it CHANGES the
    // target, so it has to be seeded, not just posted back.
    deficitOverride:
        profile?.deficitOverride ??
        _dbl(step2, 'deficitOverride') ??
        WizardDefaults.deficitOverride,
    // Always fully populated (neutral middles where nothing is saved) so
    // screen 5 opens pre-answered.
    cooking: CookingHabits(
      oilUsage:
          tryParseOilUsage(profile?.oilUsage) ??
          tryParseOilUsage(_str(step3, 'oilUsage')) ??
          kNeutralCookingDefaults.oilUsage,
      defaultRicePortion:
          tryParseRicePortion(profile?.defaultRicePortion) ??
          tryParseRicePortion(_str(step3, 'defaultRicePortion')) ??
          kNeutralCookingDefaults.defaultRicePortion,
      sugarBraised:
          tryParseSugarBraised(profile?.sugarBraised) ??
          tryParseSugarBraised(_str(step3, 'sugarBraised')) ??
          kNeutralCookingDefaults.sugarBraised,
      defaultProteinPortion:
          tryParseProteinPortion(profile?.defaultProteinPortion) ??
          tryParseProteinPortion(_str(step3, 'defaultProteinPortion')) ??
          kNeutralCookingDefaults.defaultProteinPortion,
      brothConsumption:
          tryParseBrothConsumption(profile?.brothConsumption) ??
          tryParseBrothConsumption(_str(step3, 'brothConsumption')) ??
          kNeutralCookingDefaults.brothConsumption,
    ),
  );

  return (
    answers: answers,
    device: (
      deviceCountry: deviceCountry,
      deviceLanguage: deviceLanguage,
      localeFromDevice: savedLocale == null,
    ),
  );
}
