import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../services/http/api_client.dart';
import '../../onboarding/providers/onboarding_providers.dart';

/// The on/off profile preferences Settings saves on change.
///
/// Each invalidates the profile read only after the server accepts the change,
/// so every settings reader re-seeds from the persisted value. Both read
/// through the [ProviderContainer], not the caller's `WidgetRef`: the user may
/// leave Settings while the request is in flight, and a disposed ref would
/// throw on the invalidation AFTER the change was saved — leaving the cached
/// profile showing the old value.

/// Whether newly logged meals are shared to the user's circle.
Future<bool> setAutoShareToCircle(BuildContext context, bool enabled) =>
    _put(context, '/api/v1/profile/sharing', 'autoShareToCircle', enabled);

/// Meal reminders on or off (docs/NOTIFICATIONS.md → "Reminders").
Future<bool> setMealReminders(BuildContext context, bool enabled) =>
    _put(context, '/api/v1/profile/reminders', 'mealReminders', enabled);

Future<bool> _put(
  BuildContext context,
  String path,
  String field,
  bool enabled,
) async {
  final scope = ProviderScope.containerOf(context, listen: false);
  final json = await scope.read(apiClientProvider).put<Map<String, dynamic>>(
    path,
    {field: enabled},
  );
  scope.invalidate(profileProvider);
  return (json[field] as bool?) ?? enabled;
}
