/// Profile read/write providers for the settings surface.
///
/// Ports RN `lib/onboarding/hooks/use-profile.ts` (GET) and
/// `lib/onboarding/hooks/use-save-profile.ts` (PUT) to Riverpod. Both share the
/// `['onboarding','profile']` cache key the dashboard/logging readers use; a
/// save invalidates the read so every reader refreshes.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../services/http/api_client.dart';
import '../../../models/profile/onboarding.dart';

/// The raw `userProfiles` row returned by `GET /api/v1/onboarding/profile`.
///
/// The server returns DB columns where numeric decimals (weightKg, aggression)
/// may arrive as strings; we tolerate both — mirroring the RN defaultValues
/// parsing in `profile.tsx`.
class ProfileRow {
  final Map<String, dynamic> raw;
  const ProfileRow(this.raw);

  String? _str(String k) => raw[k]?.toString();

  String? get biologicalSex => _str('biologicalSex');
  double? get weightKg {
    final v = raw['weightKg'];
    if (v == null) return null;
    return v is num ? v.toDouble() : double.tryParse(v.toString());
  }

  int? get heightCm {
    final v = raw['heightCm'];
    if (v is int) return v;
    if (v is num) return v.round();
    return v == null ? null : int.tryParse(v.toString());
  }

  int? get age {
    final v = raw['age'];
    if (v is int) return v;
    if (v is num) return v.round();
    return v == null ? null : int.tryParse(v.toString());
  }

  String? get activityLevel => _str('activityLevel');
  String? get goal => _str('goal');
  String? get aggression => _str('aggression');
  String? get carbSplit => _str('carbSplit');
  String? get countryOfOrigin => raw['countryOfOrigin'] as String?;
  String? get countryOfResidence => raw['countryOfResidence'] as String?;
  String? get oilUsage => _str('oilUsage');
  String? get defaultRicePortion => _str('defaultRicePortion');
  String? get sugarBraised => _str('sugarBraised');
  String? get defaultProteinPortion => _str('defaultProteinPortion');
  String? get brothConsumption => _str('brothConsumption');
  bool get autoShareToCircle => (raw['autoShareToCircle'] as bool?) ?? true;
}

/// Loads the user's profile row (or null if onboarding never ran). Shares the
/// `['onboarding','profile']` cache key with the dashboard/logging screens.
///
/// Keyed by [enabled] (mirrors RN `useProfile(!!userId)`): when false it short
/// circuits to null without hitting the network.
final profileProvider = FutureProvider.family<ProfileRow?, bool>((
  ref,
  enabled,
) async {
  if (!enabled) return null;
  final client = ref.read(apiClientProvider);
  final json = await client.get<Map<String, dynamic>?>(
    '/api/v1/onboarding/profile',
  );
  return json == null ? null : ProfileRow(json);
});

/// Flat PUT payload for `PUT /api/v1/profile`.
///
/// The server contract (`profileSettingsSchema`) is a FLAT object — NOT the
/// nested `ProfileSettingsInput` model shape — so this builds the wire JSON
/// directly. The form pre-computes tdee + targets and submits them.
class ProfileSavePayload {
  final double weightKg;
  final int heightCm;
  final int age;
  final BiologicalSex biologicalSex;
  final ActivityLevel activityLevel;
  final int tdeeKcal;
  final Goal goal;
  final double? aggression;
  final CarbSplit carbSplit;
  final int calorieTarget;
  final int proteinTargetG;
  final int carbsTargetG;
  final int fatTargetG;
  final String? countryOfOrigin;
  final String? countryOfResidence;
  final String preferredLocale;
  final OilUsage oilUsage;
  final RicePortion defaultRicePortion;
  final SugarBraised sugarBraised;
  final ProteinPortion defaultProteinPortion;
  final BrothConsumption brothConsumption;

  const ProfileSavePayload({
    required this.weightKg,
    required this.heightCm,
    required this.age,
    required this.biologicalSex,
    required this.activityLevel,
    required this.tdeeKcal,
    required this.goal,
    required this.aggression,
    required this.carbSplit,
    required this.calorieTarget,
    required this.proteinTargetG,
    required this.carbsTargetG,
    required this.fatTargetG,
    required this.countryOfOrigin,
    required this.countryOfResidence,
    required this.preferredLocale,
    required this.oilUsage,
    required this.defaultRicePortion,
    required this.sugarBraised,
    required this.defaultProteinPortion,
    required this.brothConsumption,
  });

  Map<String, dynamic> toJson() => {
    'weightKg': weightKg,
    'heightCm': heightCm,
    'age': age,
    'biologicalSex': biologicalSex.name,
    'activityLevel': activityLevelToString(activityLevel),
    'tdeeKcal': tdeeKcal,
    'goal': goal.name,
    'aggression': aggression,
    'carbSplit': carbSplitToString(carbSplit),
    'calorieTarget': calorieTarget,
    'proteinTargetG': proteinTargetG,
    'carbsTargetG': carbsTargetG,
    'fatTargetG': fatTargetG,
    'countryOfOrigin': countryOfOrigin,
    'countryOfResidence': countryOfResidence,
    'preferredLocale': preferredLocale,
    'oilUsage': oilUsage.name,
    'defaultRicePortion': defaultRicePortion.name,
    'sugarBraised': sugarBraised.name,
    'defaultProteinPortion': defaultProteinPortion.name,
    'brothConsumption': brothConsumptionToString(brothConsumption),
  };
}

/// Saves the profile/settings form via `PUT /api/v1/profile`. Invalidates the
/// shared profile cache on settle so dashboard/logging targets refresh.
///
/// Port of RN `useSaveProfile`. State is `AsyncValue<void>`: `loading` while
/// the request is in flight (drives the spinner + disabled buttons), `error`
/// when it fails (drives the save-error text).
class SaveProfileController extends AsyncNotifier<void> {
  @override
  Future<void> build() async {}

  Future<bool> save(ProfileSavePayload payload) async {
    state = const AsyncValue<void>.loading();
    try {
      final client = ref.read(apiClientProvider);
      await client.put<Map<String, dynamic>>(
        '/api/v1/profile',
        payload.toJson(),
      );
      state = const AsyncValue<void>.data(null);
      // Invalidate the shared profile read (prefix match) so every reader
      // refreshes — mirrors RN `invalidateQueries(onboardingKeys.profile)`.
      ref.invalidate(profileProvider);
      return true;
    } catch (e, st) {
      state = AsyncValue<void>.error(e, st);
      return false;
    }
  }
}

final saveProfileProvider = AsyncNotifierProvider<SaveProfileController, void>(
  SaveProfileController.new,
);
