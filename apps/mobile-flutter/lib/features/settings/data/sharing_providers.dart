import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/api_client.dart';
import 'profile_providers.dart';

/// Updates whether newly logged meals are shared to the user's circle.
///
/// The profile read is invalidated only after the server accepts the change,
/// so every settings reader re-seeds from the persisted preference.
Future<bool> setAutoShareToCircle(WidgetRef ref, bool enabled) async {
  final client = ref.read(apiClientProvider);
  final json = await client.put<Map<String, dynamic>>(
    '/api/v1/profile/sharing',
    {'autoShareToCircle': enabled},
  );
  ref.invalidate(profileProvider);
  return (json['autoShareToCircle'] as bool?) ?? enabled;
}
