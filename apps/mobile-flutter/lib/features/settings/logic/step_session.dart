import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../../../models/profile/onboarding.dart';
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

  /// Whether [profile] already STORES every answer this page shows. When it
  /// does not, the page opens with inferred answers filling the gaps — the
  /// phone's region and language, the wizard's defaults, the neutral cooking
  /// middles — which the user has never saved. Every field the page PRESENTS
  /// counts: one missing (a legacy profile without an activity level or a
  /// carb split) is shown as a default the user can only accept by saving.
  bool isSavedIn(ProfileRow? profile) {
    if (profile == null) return false;
    final hasBody =
        tryParseBiologicalSex(profile.biologicalSex) != null &&
        profile.weightKg != null &&
        profile.heightCm != null &&
        profile.age != null &&
        tryParseActivityLevel(profile.activityLevel) != null;
    return switch (this) {
      aboutYou => hasBody,
      goal => hasBody && _hasPlan(profile),
      cooking => storedCookingAnswers(profile).every((stored) => stored),
      region =>
        profile.countryOfOrigin != null &&
            profile.countryOfResidence != null &&
            profile.preferredLocale != null,
    };
  }

  /// The goal page's own answers: the goal, its pace (a maintaining plan has
  /// none), the carb split, and every target the card shows.
  static bool _hasPlan(ProfileRow profile) {
    final goal = tryParseGoal(profile.goal);
    return goal != null &&
        (goal == Goal.maintaining || profile.aggression != null) &&
        tryParseCarbSplit(profile.carbSplit) != null &&
        profile.field('calorieTarget') != null &&
        profile.field('proteinTargetG') != null &&
        profile.field('carbsTargetG') != null &&
        profile.field('fatTargetG') != null;
  }
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
/// one the server holds", so a change undone by hand is not dirty — and a
/// page opened on inferred answers the server never held is dirty from the
/// start, or the user could never accept them.
class StepSession extends ChangeNotifier {
  /// [storedSteps] are the pages whose answers the profile holds. When it
  /// does not include [step], the page has nothing saved behind it, so the
  /// answers it opens on — inferred, not chosen — count as a change and can
  /// be saved as they stand.
  StepSession(
    this.step,
    this.answers,
    this.device, {
    this.storedSteps = const {...SettingsStep.values},
  }) {
    _saved = storedSteps.contains(step) ? _encode(payload) : null;
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
    return StepSession(
      step,
      seeded.answers,
      seeded.device,
      storedSteps: {
        for (final s in SettingsStep.values)
          if (s.isSavedIn(profile)) s,
      },
    );
  }

  final SettingsStep step;
  final OnboardingAnswers answers;
  final OnboardingDeviceHints device;
  final Set<SettingsStep> storedSteps;

  String? _saved;

  /// What this page would post now — null when it has nothing postable yet
  /// (step 2 with a metric missing or out of range, or the goal page before
  /// the body behind its target is stored).
  ///
  /// The body and goal pages share server step 2 but post only what they
  /// SHOW: the seed fills the other page's gaps with defaults, and saving
  /// one page must not store the other's defaults as answers. The body page
  /// adds the targets only when a plan is already stored — new metrics move
  /// that plan's numbers; with no plan there are no numbers to move.
  Map<String, dynamic>? get payload => switch (step) {
    SettingsStep.aboutYou => _stepTwo([
      ..._bodyKeys,
      if (storedSteps.contains(SettingsStep.goal)) ..._targetKeys,
    ]),
    SettingsStep.goal =>
      storedSteps.contains(SettingsStep.aboutYou)
          ? _stepTwo([..._planKeys, ..._targetKeys])
          : null,
    SettingsStep.cooking => answers.stepThreePayload,
    SettingsStep.region => answers.stepOnePayload,
  };

  /// Whether the goal page is waiting on body metrics the profile does not
  /// store yet — its target is computed from ones the page only guessed.
  bool get needsBodyFirst =>
      step == SettingsStep.goal && !storedSteps.contains(SettingsStep.aboutYou);

  static const _bodyKeys = [
    'biologicalSex',
    'weightKg',
    'heightCm',
    'age',
    'activityLevel',
  ];
  static const _planKeys = [
    'goal',
    'aggression',
    'carbSplit',
    'deficitOverride',
  ];
  static const _targetKeys = [
    'tdeeKcal',
    'calorieTarget',
    'proteinTargetG',
    'carbsTargetG',
    'fatTargetG',
  ];

  Map<String, dynamic>? _stepTwo(List<String> keys) {
    final all = answers.stepTwoValues?.toJson();
    if (all == null) return null;
    return {for (final key in keys) key: all[key]};
  }

  bool get dirty => _encode(payload) != _saved;

  /// Dirty AND postable — the save button's enabled state.
  bool get canSave => dirty && payload != null;

  /// A step body changed [answers]: re-derive what the wizard re-derives, then
  /// rebuild.
  void changed() {
    answers.applyDefaultGoal();
    notifyListeners();
  }

  /// The save of [posted] landed: that payload is now what the server holds.
  ///
  /// Baselined on what was POSTED, not on what the page shows now — an edit
  /// made while the request was in flight is not on the server, so the page
  /// must stay dirty (and the save dock up) until that edit is saved too.
  void markSaved(Map<String, dynamic> posted) {
    _saved = _encode(posted);
    notifyListeners();
  }

  /// Canonical text of a payload: key order is the map's insertion order and
  /// every payload is built field by field in a fixed order, so equal answers
  /// encode equal.
  static String? _encode(Map<String, dynamic>? payload) =>
      payload == null ? null : jsonEncode(payload);
}
