/// The signed-out onboarding draft.
///
/// No web counterpart: the web wizard only runs behind auth. Mobile lets a
/// signed-out user finish the whole wizard first and sign in at the end, so the
/// three server step payloads are held locally until there is a session to post
/// them with (see `OnboardingDraftNotifier.flush`). Stored as JSON in
/// `flutter_secure_storage` — same construction/options as
/// `services/billing/activation_pending.dart` — because the payloads carry body
/// metrics.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:developer' as developer;

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../models/profile/onboarding.dart';

/// The single secure-storage key the draft lives under. Versioned so a future
/// payload change can be dropped rather than migrated.
const String kOnboardingDraftKey = 'onboarding.draft.v1';

/// The number of wizard screens — the clamp for a `screenReached` read back off
/// disk. (`kOnboardingTotalSteps` stays 3: that is the SERVER's step count.)
const int _screenCount = 6;

/// The three server step payloads plus how far the user got. Immutable; every
/// mutation goes through [copyWith].
class OnboardingDraft {
  /// `{countryOfOrigin, countryOfResidence, preferredLocale}` — screens 1–2.
  final Map<String, dynamic>? step1;

  /// The full `ScreenTwoValues` map — screens 3, 4 and 6.
  final Map<String, dynamic>? step2;

  /// The cooking-habits map — screen 5.
  final Map<String, dynamic>? step3;

  /// The highest wizard screen the user reached, 0–6.
  final int screenReached;

  const OnboardingDraft({
    this.step1,
    this.step2,
    this.step3,
    this.screenReached = 0,
  });

  /// Every server step has a payload, so the wizard has nothing left to ask.
  bool get isComplete => step1 != null && step2 != null && step3 != null;

  /// The user reached the end of the wizard — the predicate for "onboarding is
  /// done", and the one the ROUTER must use.
  ///
  /// NOT [isComplete]: screen 3's body metrics are optional, and with them
  /// blank `stepTwoValues` is null, so screens 4 and 6 post nothing and the
  /// draft never gets a `step2`. Gating `/save-plan` on [isComplete] would loop
  /// such a user back into the wizard forever.
  bool get hasFinishedScreens => screenReached >= _screenCount;

  /// Nothing worth restoring: no payloads and the wizard never advanced.
  bool get isEmpty =>
      step1 == null && step2 == null && step3 == null && screenReached == 0;

  OnboardingDraft copyWith({
    Map<String, dynamic>? step1,
    Map<String, dynamic>? step2,
    Map<String, dynamic>? step3,
    int? screenReached,
  }) => OnboardingDraft(
    step1: step1 ?? this.step1,
    step2: step2 ?? this.step2,
    step3: step3 ?? this.step3,
    screenReached: screenReached ?? this.screenReached,
  );

  /// The payload for a server step (1–3), or `null` when that step is unsaved.
  Map<String, dynamic>? stepPayload(int step) => switch (step) {
    1 => step1,
    2 => step2,
    3 => step3,
    _ => null,
  };

  OnboardingDraft withStep(int step, Map<String, dynamic> data) =>
      switch (step) {
        1 => copyWith(step1: data),
        2 => copyWith(step2: data),
        3 => copyWith(step3: data),
        _ => this,
      };

  Map<String, dynamic> toJson() => {
    if (step1 != null) 'step1': step1,
    if (step2 != null) 'step2': step2,
    if (step3 != null) 'step3': step3,
    'screenReached': screenReached,
  };

  /// One step's map, or `null` when it is missing OR carries an enum value this
  /// build no longer understands.
  ///
  /// Validated by PARSING each enum-shaped field with the same tolerant parsers
  /// the seed reads it back through. A draft written by an older build (or
  /// hand-edited) therefore costs the user that step's answers once — where the
  /// throwing parsers used to cost them the app, since the seed runs inside the
  /// wizard's `build` and a red error box there survives any relaunch.
  static Map<String, dynamic>? _step(Object? value) {
    if (value is! Map) return null;
    final step = Map<String, dynamic>.from(value);
    for (final field in _enumFields.entries) {
      final stored = step[field.key];
      if (stored == null) continue; // unanswered, not invalid
      if (stored is String && field.value(stored) != null) continue;
      developer.log(
        'onboarding draft: dropping a step whose ${field.key} '
        '($stored) is not a value this build knows',
        name: 'onboarding.draft',
      );
      return null;
    }
    return step;
  }

  factory OnboardingDraft.fromJson(Map<String, dynamic> json) {
    final reached = json['screenReached'];
    return OnboardingDraft(
      step1: _step(json['step1']),
      step2: _step(json['step2']),
      step3: _step(json['step3']),
      screenReached: reached is int ? reached.clamp(0, _screenCount) : 0,
    );
  }
}

/// Every enum-shaped field a step can carry, paired with the model parser that
/// says whether a stored string is still a value this build knows — the same
/// parsers `onboarding_seed.dart` reads the step back through. Step 1 carries
/// none of them, so it is validated by absence.
const Map<String, Object? Function(String?)> _enumFields = {
  'biologicalSex': tryParseBiologicalSex,
  'goal': tryParseGoal,
  'activityLevel': tryParseActivityLevel,
  'carbSplit': tryParseCarbSplit,
  'oilUsage': tryParseOilUsage,
  'defaultRicePortion': tryParseRicePortion,
  'sugarBraised': tryParseSugarBraised,
  'defaultProteinPortion': tryParseProteinPortion,
  'brothConsumption': tryParseBrothConsumption,
};

/// The storage seam. Narrower than [FlutterSecureStorage] so tests can hand the
/// store an in-memory map instead of a platform channel.
abstract class KeyValueStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

/// The production store. Same construction as `SecureActivationPendingStore` —
/// a `const FlutterSecureStorage()` with the package defaults.
class SecureKeyValueStore implements KeyValueStore {
  const SecureKeyValueStore({
    FlutterSecureStorage storage = const FlutterSecureStorage(),
  }) : _storage = storage;

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read(String key) => _storage.read(key: key);

  @override
  Future<void> write(String key, String value) =>
      _storage.write(key: key, value: value);

  @override
  Future<void> delete(String key) => _storage.delete(key: key);
}

/// Test double for [KeyValueStore]: a platform channel has no binding under
/// `flutter test`.
class InMemoryKeyValueStore implements KeyValueStore {
  final Map<String, String> values = {};

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<void> write(String key, String value) async {
    values[key] = value;
  }

  @override
  Future<void> delete(String key) async {
    values.remove(key);
  }
}

/// Reads/writes the draft. Every failure degrades to "no draft" rather than
/// throwing: a corrupt or unreadable draft must not be able to wedge the app on
/// launch, and the worst case is the user answering the wizard again.
class OnboardingDraftStore {
  const OnboardingDraftStore({
    KeyValueStore storage = const SecureKeyValueStore(),
  }) : _storage = storage;

  final KeyValueStore _storage;

  /// How long the read waits for the storage channel before giving up.
  ///
  /// A platform channel can simply never answer (a wedged keychain, a
  /// first-launch race), and the router holds the splash on this future. Three
  /// seconds is well past a real keychain read and well inside a launch the
  /// user reads as working.
  static const Duration readTimeout = Duration(seconds: 3);

  void _log(String message) => developer.log(message, name: 'onboarding.draft');

  Future<OnboardingDraft?> read() async {
    String? raw;
    try {
      raw = await _storage.read(kOnboardingDraftKey).timeout(readTimeout);
    } on TimeoutException {
      _log('onboarding draft read timed out after $readTimeout');
      return null;
    } catch (e) {
      _log('onboarding draft unreadable: $e');
      return null;
    }
    if (raw == null || raw.isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return null;
      return OnboardingDraft.fromJson(Map<String, dynamic>.from(decoded));
    } catch (e) {
      _log('onboarding draft corrupt, discarding: $e');
      return null;
    }
  }

  Future<void> write(OnboardingDraft draft) async {
    try {
      await _storage.write(kOnboardingDraftKey, jsonEncode(draft.toJson()));
    } catch (e) {
      _log('onboarding draft unwritable: $e');
    }
  }

  Future<void> clear() async {
    try {
      await _storage.delete(kOnboardingDraftKey);
    } catch (e) {
      _log('onboarding draft not cleared: $e');
    }
  }
}
