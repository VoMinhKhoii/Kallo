/// The profile read for the settings surface (port of web
/// `hooks/profile/use-profile.ts`).
///
/// Settings no longer WRITES through `PUT /api/v1/profile`: its profile pages
/// are the onboarding steps and save through the per-step endpoint
/// (`data/step_save.dart`), which accepts a partial profile.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../services/http/api_client.dart';

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
  String? get defaultProteinPortion => _str('defaultProteinPortion');
  String? get brothConsumption => _str('brothConsumption');
  // Mirrors the server default (off): a missing field never reads as opted in.
  bool get autoShareToCircle => (raw['autoShareToCircle'] as bool?) ?? false;
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
