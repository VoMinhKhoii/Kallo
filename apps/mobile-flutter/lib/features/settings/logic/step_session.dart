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
}

/// Whether [profile] stores the body behind every target: sex, weight,
/// height, age AND activity level — the last is what a legacy profile tends
/// to lack, and the target is computed from it all the same.
bool storedBody(ProfileRow? profile) =>
    profile != null &&
    tryParseBiologicalSex(profile.biologicalSex) != null &&
    profile.weightKg != null &&
    profile.heightCm != null &&
    profile.age != null &&
    tryParseActivityLevel(profile.activityLevel) != null;

/// Whether [profile] stores a plan — goal, pace (a maintaining plan has
/// none), carb split and every target the card shows — whether or not the
/// body behind it is complete.
bool storedPlan(ProfileRow? profile) {
  final goal = tryParseGoal(profile?.goal);
  return profile != null &&
      goal != null &&
      (goal == Goal.maintaining || profile.aggression != null) &&
      tryParseCarbSplit(profile.carbSplit) != null &&
      profile.field('calorieTarget') != null &&
      profile.field('proteinTargetG') != null &&
      profile.field('carbsTargetG') != null &&
      profile.field('fatTargetG') != null;
}

/// One open Settings step page: the onboarding [answers] seeded from the saved
/// profile, what the server stores for the fields this page posts, and
/// whether the page differs from that.
///
/// Settings reuses the onboarding step bodies, which edit a mutable
/// [OnboardingAnswers] and call back; this is the host-side half of that
/// contract — the same `applyDefaultGoal` + rebuild the wizard runs
/// (`onboarding_wizard.dart`, `changed()`), plus the dirty check the wizard
/// never needed.
///
/// Dirty is "what this page would post differs from what the server STORES
/// for those fields", compared value by value. So a change undone by hand is
/// not dirty; a page opened on inferred answers the server never held (the
/// phone's region, the neutral cooking middles, a legacy gap) is dirty from
/// the start, or they could never be accepted; and stored targets that no
/// longer match the calculator show as a change the user can save.
class StepSession extends ChangeNotifier {
  /// [stored] is the profile row as the server holds it; null means nothing
  /// is stored.
  StepSession(
    this.step,
    this.answers,
    this.device, {
    required ProfileRow? stored,
  }) : _bodyStored = storedBody(stored),
       _planStored = storedPlan(stored) {
    _saved = _canon(
      stored == null ? null : {for (final k in _keys) k: stored.field(k)},
    );
  }

  /// Seeds from [profile] exactly as the wizard does, minus the draft: a saved
  /// answer wins, the phone fills only what was never answered.
  ///
  /// [activeLocale] is the language the app is running in. It wins over the
  /// stored one for what the page SHOWS — on a new device, or after local
  /// storage is cleared, the two differ, and a picker showing the stored
  /// language selected would make its row a dead tap (already "picked") while
  /// the app speaks the other. The stored value stays the baseline, so the
  /// mismatch opens the page with "Lưu" ready to store the language in use.
  factory StepSession.fromProfile(
    SettingsStep step,
    ProfileRow? profile, {
    String? activeLocale,
  }) {
    final seeded = buildOnboardingAnswers(
      profile: profile,
      draft: null,
      deviceRegion: deviceRegionCode(),
      deviceLanguage: deviceLanguageCode(),
    );
    final active = supportedLocaleOrNull(activeLocale);
    if (active != null) seeded.answers.preferredLocale = active;
    return StepSession(step, seeded.answers, seeded.device, stored: profile);
  }

  final SettingsStep step;
  final OnboardingAnswers answers;
  final OnboardingDeviceHints device;
  final bool _bodyStored;
  final bool _planStored;

  String? _saved;

  /// What this page would post now — null when it has nothing postable yet
  /// (step 2 with a metric missing or out of range, or the goal page before
  /// the body behind its target is stored).
  ///
  /// The body and goal pages share server step 2 but post only what they
  /// SHOW ([_keys]): the seed fills the other page's gaps with defaults, and
  /// saving one page must not store the other's defaults as answers.
  Map<String, dynamic>? get payload => switch (step) {
    SettingsStep.aboutYou => _stepTwo(),
    SettingsStep.goal => _bodyStored ? _stepTwo() : null,
    SettingsStep.cooking => answers.stepThreePayload,
    SettingsStep.region => answers.stepOnePayload,
  };

  /// The fields this page posts. The body page carries the targets too when
  /// a plan is stored — new metrics move that plan's numbers — but not
  /// otherwise: with no plan there are no numbers to move.
  List<String> get _keys => switch (step) {
    SettingsStep.aboutYou => [..._bodyKeys, if (_planStored) ..._targetKeys],
    SettingsStep.goal => [..._planKeys, ..._targetKeys],
    SettingsStep.cooking => _cookingKeys,
    SettingsStep.region => _regionKeys,
  };

  /// Whether the goal page is waiting on body metrics the profile does not
  /// store yet — its target is computed from ones the page only guessed.
  bool get needsBodyFirst => step == SettingsStep.goal && !_bodyStored;

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

  static const _cookingKeys = [
    'oilUsage',
    'defaultRicePortion',
    'defaultProteinPortion',
    'brothConsumption',
  ];
  static const _regionKeys = [
    'countryOfOrigin',
    'countryOfResidence',
    'preferredLocale',
  ];

  Map<String, dynamic>? _stepTwo() {
    final all = answers.stepTwoValues?.toJson();
    if (all == null) return null;
    return {for (final key in _keys) key: all[key]};
  }

  /// The goal page waiting on the body is not "changed" — it cannot be
  /// saved yet, and says so instead of raising a dead save dock.
  bool get dirty => !needsBodyFirst && _canon(payload) != _saved;

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
    _saved = _canon(posted);
    notifyListeners();
  }

  /// Canonical text of a payload, comparable with what the server stores:
  /// the DB hands decimals back as strings ("68.5", "0.5") and whole numbers
  /// as ints, so every number — or numeric string — compares as a double.
  /// Keys come in [_keys] order. All-null (nothing stored, nothing postable)
  /// is null, so an empty profile and an unpostable page agree.
  static String? _canon(Map<String, dynamic>? values) {
    if (values == null || values.values.every((v) => v == null)) return null;
    Object? norm(Object? v) => switch (v) {
      num() => v.toDouble(),
      String() => double.tryParse(v) ?? v,
      _ => v,
    };
    return jsonEncode({for (final e in values.entries) e.key: norm(e.value)});
  }
}
