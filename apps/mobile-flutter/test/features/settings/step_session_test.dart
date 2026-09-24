import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/onboarding/data/profile_row.dart';
import 'package:kallo_mobile/features/settings/logic/step_session.dart';
import 'package:kallo_mobile/models/profile/onboarding.dart';

import '../onboarding/onboarding_test_support.dart';
import 'settings_test_support.dart';

/// The Settings step pages show their save button only while the page holds
/// something the server does not. "Dirty" is therefore a comparison of what
/// the page WOULD post against what the server holds — not a flag set on
/// edit.
StepSession _session(SettingsStep step) => StepSession(step, testAnswers(), (
  deviceCountry: null,
  deviceLanguage: 'vi',
  localeFromDevice: false,
));

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

  test('a page opened on answers the server never held can save them', () {
    // Nothing saved: cooking opens on the neutral middles, which the user
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

  test('a page whose answers are all stored opens clean', () {
    for (final step in SettingsStep.values) {
      final session = StepSession.fromProfile(
        step,
        const ProfileRow(kFullProfile),
      );
      expect(session.dirty, isFalse, reason: step.name);
    }
  });

  test('region counts as stored only once both countries are', () {
    expect(
      SettingsStep.region.isSavedIn(
        const ProfileRow({'preferredLocale': 'vi'}),
      ),
      isFalse,
    );
    expect(
      SettingsStep.region.isSavedIn(const ProfileRow(kFullProfile)),
      isTrue,
    );
  });

  test('a field the page shows but the profile lacks is not "stored"', () {
    // A legacy profile: a body without an activity level, a goal without a
    // carb split. Each page shows a default there, so it must open savable.
    final noActivity = ProfileRow(
      Map.of(kFullProfile)..remove('activityLevel'),
    );
    final noSplit = ProfileRow(Map.of(kFullProfile)..remove('carbSplit'));
    final noProtein = ProfileRow(
      Map.of(kFullProfile)..remove('defaultProteinPortion'),
    );
    expect(SettingsStep.aboutYou.isSavedIn(noActivity), isFalse);
    expect(SettingsStep.goal.isSavedIn(noActivity), isFalse);
    expect(SettingsStep.goal.isSavedIn(noSplit), isFalse);
    expect(SettingsStep.aboutYou.isSavedIn(noSplit), isTrue);
    expect(SettingsStep.cooking.isSavedIn(noProtein), isFalse);
  });

  test('a maintaining plan is stored without a pace', () {
    final maintaining = ProfileRow(
      Map.of(kFullProfile)
        ..['goal'] = 'maintaining'
        ..remove('aggression'),
    );
    expect(SettingsStep.goal.isSavedIn(maintaining), isTrue);
  });
}
