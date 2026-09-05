// The wizard's opening answers: profile → draft → device/neutral, resolved
// once. Everything downstream (the six screens, the three payloads) reads what
// this builds and nothing else, so a precedence slip here is invisible until a
// signed-in user's saved country is silently replaced by their phone's.
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/onboarding/data/onboarding_draft.dart';
import 'package:kallo_mobile/features/onboarding/data/profile_row.dart';
import 'package:kallo_mobile/features/onboarding/logic/onboarding_answers.dart';
import 'package:kallo_mobile/features/onboarding/logic/onboarding_seed.dart';
import 'package:kallo_mobile/models/profile/onboarding.dart';

/// Every field the seed reads, all set to values the draft and the device do
/// NOT carry — so any field that fell through to a lower source is visible.
const _profile = ProfileRow({
  'preferredLocale': 'vi',
  'countryOfOrigin': 'Japan',
  'countryOfResidence': 'Germany',
  'biologicalSex': 'female',
  'weightKg': '61.5', // Drizzle decimals arrive as strings
  'heightCm': 165,
  'age': 41,
  'activityLevel': 'very_active',
  'goal': 'bulking',
  'aggression': '0.3',
  'carbSplit': 'higher_carb',
  'deficitOverride': 300,
  'oilUsage': 'heavy',
  'defaultRicePortion': 'large',
  'sugarBraised': 'low',
  'defaultProteinPortion': 'small',
  'brothConsumption': 'finish_it',
});

const _draft = OnboardingDraft(
  step1: {
    'preferredLocale': 'en',
    'countryOfOrigin': 'France',
    'countryOfResidence': 'France',
  },
  step2: {
    'biologicalSex': 'male',
    'weightKg': 80,
    'heightCm': 180,
    'age': 22,
    'activityLevel': 'moderate',
    'goal': 'cutting',
    'aggression': 0.7,
    'carbSplit': 'lower_carb',
    'deficitOverride': 150,
  },
  step3: {
    'oilUsage': 'minimal',
    'defaultRicePortion': 'small',
    'sugarBraised': 'high',
    'defaultProteinPortion': 'large',
    'brothConsumption': 'leave_it',
  },
  screenReached: 4,
);

({OnboardingAnswers answers, OnboardingDeviceHints device}) _seed({
  ProfileRow? profile,
  OnboardingDraft? draft,
  String? region = 'AU',
  String language = 'en',
}) =>
    buildOnboardingAnswers(
      profile: profile,
      draft: draft,
      deviceRegion: region,
      deviceLanguage: language,
    );

OnboardingAnswers _answers({
  ProfileRow? profile,
  OnboardingDraft? draft,
  String? region = 'AU',
  String language = 'en',
}) =>
    _seed(profile: profile, draft: draft, region: region, language: language)
        .answers;

void main() {
  group('precedence', () {
    test('the profile wins every field it has', () {
      final answers = _answers(profile: _profile, draft: _draft);

      expect(answers.preferredLocale, 'vi');
      expect(answers.countryOfOrigin, 'Japan');
      expect(answers.countryOfResidence, 'Germany');
      expect(answers.biologicalSex, BiologicalSex.female);
      expect(answers.weightKg, 61.5);
      expect(answers.heightCm, 165);
      expect(answers.age, 41);
      expect(answers.activityLevel, ActivityLevel.veryActive);
      expect(answers.goal, Goal.bulking);
      expect(answers.aggression, 0.3);
      expect(answers.carbSplit, CarbSplit.higherCarb);
      expect(answers.deficitOverride, 300);
      expect(answers.cooking.toJson(), {
        'oilUsage': 'heavy',
        'defaultRicePortion': 'large',
        'sugarBraised': 'low',
        'defaultProteinPortion': 'small',
        'brothConsumption': 'finish_it',
      });
    });

    test('with no profile the draft wins every field it has', () {
      final answers = _answers(draft: _draft);

      expect(answers.preferredLocale, 'en');
      expect(answers.countryOfOrigin, 'France');
      expect(answers.countryOfResidence, 'France');
      expect(answers.biologicalSex, BiologicalSex.male);
      expect(answers.weightKg, 80);
      expect(answers.heightCm, 180);
      expect(answers.age, 22);
      expect(answers.activityLevel, ActivityLevel.moderate);
      expect(answers.goal, Goal.cutting);
      expect(answers.aggression, 0.7);
      expect(answers.carbSplit, CarbSplit.lowerCarb);
      expect(answers.deficitOverride, 150);
      expect(answers.cooking.oilUsage, OilUsage.minimal);
      expect(answers.cooking.brothConsumption, BrothConsumption.leaveIt);
    });

    test('with neither, the device fills what it can and the rest is neutral',
        () {
      final seed = _seed(region: 'VN', language: 'vi');
      final answers = seed.answers;

      expect(seed.device.deviceCountry, 'Vietnam');
      expect(answers.countryOfOrigin, 'Vietnam');
      expect(answers.countryOfResidence, 'Vietnam');
      expect(answers.preferredLocale, 'vi');
      // Nothing invents a body: the metrics stay blank and screen 6 says so.
      expect(answers.biologicalSex, isNull);
      expect(answers.weightKg, isNull);
      expect(answers.heightCm, isNull);
      expect(answers.age, isNull);
      expect(answers.activityLevel, ActivityLevel.light);
      expect(answers.goal, Goal.maintaining);
      expect(answers.aggression, 0.5);
      expect(answers.carbSplit, CarbSplit.moderateCarb);
      expect(answers.deficitOverride, isNull);
      expect(answers.cooking.toJson(), {
        'oilUsage': 'normal',
        'defaultRicePortion': 'medium',
        'sugarBraised': 'medium',
        'defaultProteinPortion': 'medium',
        'brothConsumption': 'some',
      });
    });

    test('a region Kallo does not list leaves the country blank, not wrong',
        () {
      final seed = _seed(region: 'ZZ');
      expect(seed.device.deviceCountry, isNull);
      expect(seed.answers.countryOfOrigin, isNull);
      expect(seed.answers.countryOfResidence, isNull);
    });

    test('no device region at all leaves the countries unanswered', () {
      final seed = _seed(region: null);
      expect(seed.device.deviceCountry, isNull);
      expect(seed.answers.countryOfOrigin, isNull);
      expect(seed.answers.countryOfResidence, isNull);
      expect(seed.answers.preferredLocale, 'en');
    });

    test('the phone fills every blank when there is nothing saved', () {
      final seed = _seed(region: 'AU', language: 'vi');
      expect(seed.answers.countryOfOrigin, 'Australia');
      expect(seed.answers.countryOfResidence, 'Australia');
      expect(seed.answers.preferredLocale, 'vi');
    });

    test('precedence is per FIELD, not per source', () {
      // A profile that only ever finished step 1 still takes its metrics from
      // the draft rather than throwing them away.
      const partial = ProfileRow({'countryOfOrigin': 'Japan'});
      final answers = _answers(profile: partial, draft: _draft);

      expect(answers.countryOfOrigin, 'Japan');
      expect(answers.weightKg, 80);
      expect(answers.cooking.oilUsage, OilUsage.minimal);
    });

    test('an enum value this build does not know falls through, it does not '
        'throw', () {
      // The draft validator drops a whole step for one of these; a SERVER row
      // written by a newer build reaches the seed intact, and the seed is
      // inside the wizard's `build`.
      final answers = _answers(
        profile: const ProfileRow({'goal': 'recomping', 'oilUsage': 'none'}),
        draft: _draft,
      );
      expect(answers.goal, Goal.cutting, reason: 'falls through to the draft');
      expect(answers.cooking.oilUsage, OilUsage.minimal);
    });
  });

  group('aggression', () {
    test('parses the numeric STRING the profile stores it as', () {
      expect(
        _answers(profile: const ProfileRow({'aggression': '0.25'})).aggression,
        0.25,
      );
    });

    test('an unparseable profile value falls back rather than poisoning the '
        'ruler', () {
      // `double.tryParse('fast')` is null, and a NaN here would put the pace
      // ruler's index at NaN — every graduation, and the readout, gone.
      expect(
        _answers(
          profile: const ProfileRow({'aggression': 'fast'}),
          draft: _draft,
        ).aggression,
        0.7,
        reason: 'falls through to the draft, not to NaN',
      );
      expect(
        _answers(profile: const ProfileRow({'aggression': ''})).aggression,
        0.5,
        reason: 'and to the wizard default when there is no draft either',
      );
    });
  });

  group('cooking', () {
    test('falls back field by field: profile, then draft, then the middle', () {
      const half = ProfileRow({'oilUsage': 'heavy'});
      const draft = OnboardingDraft(step3: {'sugarBraised': 'high'});
      final cooking = _answers(profile: half, draft: draft).cooking;

      expect(cooking.oilUsage, OilUsage.heavy);
      expect(cooking.sugarBraised, SugarBraised.high);
      expect(cooking.defaultRicePortion, RicePortion.medium);
      expect(cooking.toJson().keys, hasLength(5),
          reason: 'screen 5 opens pre-answered, so all five are always set');
    });
  });

  group('localeFromDevice', () {
    test('is true only when nothing SAVED a locale', () {
      expect(_seed().device.localeFromDevice, isTrue);
      expect(_seed(profile: _profile).device.localeFromDevice, isFalse);
      expect(_seed(draft: _draft).device.localeFromDevice, isFalse);
    });

    test('a device language Kallo does not ship falls back to en', () {
      final seed = _seed(language: 'en', region: 'DE');
      expect(seed.answers.preferredLocale, 'en');
      expect(seed.device.localeFromDevice, isTrue);
    });

    test('an unsupported locale on either side falls back to en', () {
      final answers = _answers(
        profile: const ProfileRow({'preferredLocale': 'fr'}),
        region: null,
        language: 'de',
      );
      expect(answers.preferredLocale, 'en');
    });
  });
}
