import 'package:flutter/foundation.dart';

import '../../../services/http/api_client.dart';

/// Best-effort hand-off of a Sign in with Apple authorization code to the
/// server, which exchanges it for a refresh token so account deletion can
/// revoke it (Apple's account-deletion requirement).
///
/// Never throws and never blocks sign-in: the caller does not await it. A
/// lost code only means deletion cannot revoke this particular authorization;
/// the next Apple sign-in posts a fresh one.
Future<void> postAppleCodeBestEffort(
  ApiClient api,
  String? authorizationCode,
) async {
  if (authorizationCode == null || authorizationCode.isEmpty) return;
  try {
    await api.linkAppleAuthorizationCode(authorizationCode);
  } catch (error) {
    if (kDebugMode) debugPrint('Apple token link failed: $error');
  }
}
