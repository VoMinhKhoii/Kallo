import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../services/push/push_service.dart';

/// A meal was saved: the one moment the app asks for notification permission
/// (docs/NOTIFICATIONS.md → "Reminders", "Permission"), so the prompt arrives
/// when reminders about logging make sense, never at sign-up. iOS shows it once
/// in the app's life; [PushService.askPermission] also asks once per process.
/// Called after every SAVE (confirm, manual, barcode, label scan), never after
/// staging a card that still waits for its confirm.
///
/// Never throws: it runs right after a meal COMMITTED, and a scope disposed
/// mid-request (the sheet swiped away) must not turn that save into a failure.
/// Losing the prompt this once is fine — the next save asks again.
void askForNotificationsAfterSave(
  T Function<T>(ProviderListenable<T> provider) read,
) {
  try {
    unawaited(read(pushServiceProvider).askPermission());
  } catch (_) {
    // Disposed scope: no prompt this time.
  }
}
