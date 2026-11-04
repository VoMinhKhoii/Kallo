import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../services/http/api_client.dart';
import '../../onboarding/providers/onboarding_providers.dart';

/// Turns meal reminders on or off (`PUT /api/v1/profile/reminders`).
///
/// The profile read is invalidated only after the server accepts the change,
/// so every settings reader re-seeds from the persisted preference.
Future<bool> setMealReminders(WidgetRef ref, bool enabled) async {
  final client = ref.read(apiClientProvider);
  final json = await client.put<Map<String, dynamic>>(
    '/api/v1/profile/reminders',
    {'mealReminders': enabled},
  );
  ref.invalidate(profileProvider);
  return (json['mealReminders'] as bool?) ?? enabled;
}
