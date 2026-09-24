import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../../onboarding/data/profile_row.dart';
import '../../onboarding/logic/onboarding_answers.dart';
import '../../onboarding/logic/onboarding_seed.dart';
import '../../onboarding/logic/region_defaults.dart';

/// The four Settings pages that ARE onboarding steps — each edits exactly the
/// fields one server step owns, so a page saves with that step's payload.
enum SettingsStep {
  /// Onboarding screen 3 — sex, metrics, activity. Server step 2.
  aboutYou(2),

  /// Screens 4 + 6 — goal, pace, carb split and the target they produce.
  /// Server step 2, like [aboutYou]: the target is computed from both.
  goal(2),

  /// Screen 5. Server step 3.
  cooking(3),

  /// Screens 1 + 2 — app language, origin, residence. Server step 1.
  region(1);

  const SettingsStep(this.serverStep);

  /// The `step` posted to `/api/v1/onboarding/screen`.
  final int serverStep;
}

/// One open Settings step page: the onboarding [answers] seeded from the saved
/// profile, the payload as it was when the page opened, and whether the user
/// has changed it since.
///
/// Settings reuses the onboarding step bodies, which edit a mutable
/// [OnboardingAnswers] and call back; this is the host-side half of that
/// contract — the same `applyDefaultGoal` + rebuild the wizard runs
/// (`onboarding_wizard.dart`, `changed()`), plus the dirty snapshot the wizard
/// never needed. Dirty is "the payload this page would post differs from the
/// one it opened with", so a change undone by hand is not dirty.
class StepSession extends ChangeNotifier {
  StepSession._(this.step, this.answers, this.device) {
    _saved = _encode(payload);
  }

  /// Seeds from [profile] exactly as the wizard does, minus the draft: a saved
  /// answer wins, the phone fills only what was never answered.
  factory StepSession.fromProfile(SettingsStep step, ProfileRow? profile) {
    final seeded = buildOnboardingAnswers(
      profile: profile,
      draft: null,
      deviceRegion: deviceRegionCode(),
      deviceLanguage: deviceLanguageCode(),
    );
    return StepSession._(step, seeded.answers, seeded.device);
  }

  @visibleForTesting
  factory StepSession.forTest(SettingsStep step, OnboardingAnswers answers) =>
      StepSession._(step, answers, (
        deviceCountry: null,
        deviceLanguage: answers.preferredLocale,
        localeFromDevice: false,
      ));

  final SettingsStep step;
  final OnboardingAnswers answers;
  final OnboardingDeviceHints device;

  String? _saved;

  /// What this page would post now — null when it has nothing postable yet
  /// (step 2 with a metric missing or out of range).
  Map<String, dynamic>? get payload => switch (step) {
    SettingsStep.aboutYou ||
    SettingsStep.goal => answers.stepTwoValues?.toJson(),
    SettingsStep.cooking => answers.stepThreePayload,
    SettingsStep.region => answers.stepOnePayload,
  };

  bool get dirty => _encode(payload) != _saved;

  /// Dirty AND postable — the save button's enabled state.
  bool get canSave => dirty && payload != null;

  /// A step body changed [answers]: re-derive what the wizard re-derives, then
  /// rebuild.
  void changed() {
    answers.applyDefaultGoal();
    notifyListeners();
  }

  /// The save landed — what is on screen is now what is saved.
  void markSaved() {
    _saved = _encode(payload);
    notifyListeners();
  }

  /// Canonical text of a payload: key order is the map's insertion order and
  /// every payload is built field by field in a fixed order, so equal answers
  /// encode equal.
  static String? _encode(Map<String, dynamic>? payload) =>
      payload == null ? null : jsonEncode(payload);
}
