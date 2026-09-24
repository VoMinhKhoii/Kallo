import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/onboarding/data/profile_row.dart';
import 'package:kallo_mobile/features/onboarding/logic/onboarding_answers.dart';
import 'package:kallo_mobile/features/settings/logic/step_session.dart';
import 'package:kallo_mobile/features/settings/widgets/chrome/settings_step_page.dart';
import 'package:kallo_mobile/models/profile/onboarding.dart';

import '../onboarding/onboarding_test_support.dart';
import 'settings_test_support.dart';

/// The Settings step pages show their save button only while the page holds
/// something the server does not. "Dirty" is therefore a comparison of what
/// the page WOULD post against what the server STORES — not a flag set on
/// edit.

const _device = (
  deviceCountry: null,
  deviceLanguage: 'vi',
  localeFromDevice: false,
);

/// The row the server would hold had these exact answers been saved.
ProfileRow _storedFrom(OnboardingAnswers a) => ProfileRow({
  ...a.stepOnePayload,
  ...a.stepTwoValues!.toJson(),
  ...a.stepThreePayload,
});

/// A page over answers the server already holds, value for value.
StepSession _session(SettingsStep step) {
  final answers = testAnswers();
  return StepSession(step, answers, _device, stored: _storedFrom(answers));
}

ProfileRow _without(List<String> keys) =>
    ProfileRow(Map.of(kFullProfile)..removeWhere((k, _) => keys.contains(k)));

void main() {
  // fromProfile reads the phone's region and language off the binding.
  TestWidgetsFlutterBinding.ensureInitialized();

  test('opens clean; an edit dirties it; undoing the edit cleans it', () {
    final session = _session(SettingsStep.cooking);
    expect(session.dirty, isFalse);

    final before = session.answers.cooking;
    session.answers.cooking = before.copyWith(oilUsage: OilUsage.heavy);
    session.changed();
    expect(session.dirty, isTrue);
    expect(session.canSave, isTrue);

    session.answers.cooking = before;
    session.changed();
    expect(session.dirty, isFalse);
  });

  test('a save makes what is on screen the new baseline', () {
    final session = _session(SettingsStep.cooking);
    session.answers.cooking = session.answers.cooking.copyWith(
      oilUsage: OilUsage.minimal,
    );
    session.changed();
    session.markSaved(session.payload!);
    expect(session.dirty, isFalse);
  });

  test('step 2 with a metric cleared is dirty but not savable', () {
    final session = _session(SettingsStep.aboutYou);
    session.answers.weightKg = null;
    session.changed();
    expect(session.payload, isNull);
    expect(session.dirty, isTrue);
    expect(session.canSave, isFalse);
  });

  test('each page posts the server step that owns its fields', () {
    expect(SettingsStep.region.serverStep, 1);
    expect(SettingsStep.aboutYou.serverStep, 2);
    expect(SettingsStep.goal.serverStep, 2);
    expect(SettingsStep.cooking.serverStep, 3);
  });

  group('the baseline is what the server stores', () {
    test('a fully stored profile opens every page clean', () {
      for (final step in SettingsStep.values) {
        final session = StepSession.fromProfile(
          step,
          const ProfileRow(kFullProfile),
        );
        expect(session.dirty, isFalse, reason: step.name);
      }
    });

    test('answers the server never held can be saved as they stand', () {
      // Nothing stored: cooking opens on the neutral middles, which the user
      // must be able to accept without first picking something else.
      final session = StepSession.fromProfile(
        SettingsStep.cooking,
        const ProfileRow({'preferredLocale': 'vi'}),
      );
      expect(session.dirty, isTrue);
      expect(session.canSave, isTrue);
      session.markSaved(session.payload!);
      expect(session.dirty, isFalse);
    });

    test('a legacy gap a page shows opens that page savable', () {
      expect(
        StepSession.fromProfile(
          SettingsStep.aboutYou,
          _without(['activityLevel']),
        ).dirty,
        isTrue,
      );
      expect(
        StepSession.fromProfile(
          SettingsStep.goal,
          _without(['carbSplit']),
        ).dirty,
        isTrue,
      );
      expect(
        StepSession.fromProfile(
          SettingsStep.cooking,
          _without(['defaultProteinPortion']),
        ).dirty,
        isTrue,
      );
      // A gap on ANOTHER page's fields leaves this one clean.
      expect(
        StepSession.fromProfile(
          SettingsStep.aboutYou,
          _without(['carbSplit']),
        ).dirty,
        isFalse,
      );
    });

    test('stored targets the calculator no longer produces can be saved', () {
      // All present, but written by an older formula: the page shows the
      // recomputed numbers, so it must offer to store them.
      final stale = ProfileRow(Map.of(kFullProfile)..['proteinTargetG'] = 120);
      final goal = StepSession.fromProfile(SettingsStep.goal, stale);
      expect(goal.dirty, isTrue);
      expect(goal.canSave, isTrue);
    });

    test('decimals stored as strings compare equal to the numbers shown', () {
      // kFullProfile holds weightKg '68.5' and aggression '0.5' as the DB
      // returns them; the page holds 68.5 and 0.5.
      final session = StepSession.fromProfile(
        SettingsStep.goal,
        const ProfileRow(kFullProfile),
      );
      expect(session.dirty, isFalse);
    });
  });

  group('body and goal share step 2 but post only what they show', () {
    test('the body page with no plan stored posts the body alone', () {
      final session = StepSession.fromProfile(
        SettingsStep.aboutYou,
        _without(['goal', 'calorieTarget']),
      );
      expect(session.payload!.keys, [
        'biologicalSex',
        'weightKg',
        'heightCm',
        'age',
        'activityLevel',
      ]);
    });

    test('a stored plan rides along with new metrics, recomputed', () {
      // Even when the body is incomplete (a legacy row without activity),
      // the plan is stored, so the metrics that complete it move its targets.
      final session = StepSession.fromProfile(
        SettingsStep.aboutYou,
        _without(['activityLevel']),
      );
      final keys = session.payload!.keys;
      expect(keys, containsAll(['calorieTarget', 'proteinTargetG']));
      expect(keys, isNot(contains('goal')));
      expect(keys, isNot(contains('carbSplit')));
    });

    test('the goal page posts the plan, never the body', () {
      final session = StepSession.fromProfile(
        SettingsStep.goal,
        const ProfileRow(kFullProfile),
      );
      final keys = session.payload!.keys;
      expect(keys, containsAll(['goal', 'aggression', 'carbSplit']));
      expect(keys, containsAll(['calorieTarget', 'fatTargetG']));
      expect(keys, isNot(contains('activityLevel')));
      expect(keys, isNot(contains('weightKg')));
    });

    test('the goal page waits for a stored body, without a dead dock', () {
      final goal = StepSession.fromProfile(
        SettingsStep.goal,
        _without(['activityLevel']),
      );
      expect(goal.payload, isNull);
      expect(goal.needsBodyFirst, isTrue);
      expect(goal.dirty, isFalse);
    });
  });

  test('a body counts as stored only with its activity level', () {
    expect(storedBody(const ProfileRow(kFullProfile)), isTrue);
    expect(storedBody(_without(['activityLevel'])), isFalse);
  });

  test('a plan counts as stored with every target, whatever the body', () {
    expect(storedPlan(_without(['activityLevel'])), isTrue);
    expect(storedPlan(_without(['fatTargetG'])), isFalse);
    expect(
      storedPlan(
        ProfileRow(
          Map.of(kFullProfile)
            ..['goal'] = 'maintaining'
            ..remove('aggression'),
        ),
      ),
      isTrue,
    );
  });

  test('a page seeds only from a settled profile, never a refetching one', () {
    const row = ProfileRow(kFullProfile);
    expect(readyToSeed(const AsyncData<ProfileRow?>(row)), isTrue);
    expect(readyToSeed(const AsyncData<ProfileRow?>(null)), isTrue);
    // Right after a save invalidates the profile, the old row is still the
    // value while the fresh one loads.
    final refreshing = const AsyncLoading<ProfileRow?>().copyWithPrevious(
      const AsyncData<ProfileRow?>(row),
    );
    expect(refreshing.hasValue, isTrue);
    expect(readyToSeed(refreshing), isFalse);
    expect(readyToSeed(const AsyncLoading<ProfileRow?>()), isFalse);
  });

  test('the region page shows the language the app is running in', () {
    // A new device: the app came up in Vietnamese, the profile says English.
    final region = StepSession.fromProfile(
      SettingsStep.region,
      ProfileRow(Map.of(kFullProfile)..['preferredLocale'] = 'en'),
      activeLocale: 'vi',
    );
    expect(region.payload!['preferredLocale'], 'vi');
    // Stored is still 'en', so the page offers to store the language in use.
    expect(region.dirty, isTrue);

    final agreed = StepSession.fromProfile(
      SettingsStep.region,
      const ProfileRow(kFullProfile),
      activeLocale: 'vi',
    );
    expect(agreed.dirty, isFalse);
  });
}
