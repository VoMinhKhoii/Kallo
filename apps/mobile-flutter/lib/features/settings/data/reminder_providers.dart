import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../services/http/api_client.dart';
import '../../onboarding/providers/onboarding_providers.dart';

/// Turns meal reminders on or off (`PUT /api/v1/profile/reminders`).
///
/// The profile read is invalidated only after the server accepts the change,
/// so every settings reader re-seeds from the persisted preference. Reads
/// through the [ProviderContainer], not the caller's `WidgetRef`: the user may
/// leave Settings while the request is in flight, and a disposed ref would
/// throw on the invalidation AFTER the change was saved — leaving the cached
/// profile showing the old value.
Future<bool> setMealReminders(BuildContext context, bool enabled) async {
  final scope = ProviderScope.containerOf(context, listen: false);
  final json = await scope.read(apiClientProvider).put<Map<String, dynamic>>(
    '/api/v1/profile/reminders',
    {'mealReminders': enabled},
  );
  scope.invalidate(profileProvider);
  return (json['mealReminders'] as bool?) ?? enabled;
}
