import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/settings/logic/step_session.dart';
import 'package:kallo_mobile/models/profile/onboarding.dart';

import '../onboarding/onboarding_test_support.dart';

/// The Settings step pages show their save button only while the page holds
/// something the server does not. "Dirty" is therefore a comparison of what
/// the page WOULD post against what it opened with — not a flag set on edit.
StepSession _session(SettingsStep step) => StepSession(step, testAnswers(), (
  deviceCountry: null,
  deviceLanguage: 'vi',
  localeFromDevice: false,
));

void main() {
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
    session.markSaved();
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
}
