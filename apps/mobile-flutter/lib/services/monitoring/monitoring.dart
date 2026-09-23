/// Crash + error reporting (Sentry, US region).
///
/// Env-gated like analytics: with no `SENTRY_DSN` dart-define the app runs
/// exactly as before — no SDK init, no platform channels, no network. That is
/// also what keeps `test/widget_test.dart` channel-free.
///
/// Privacy: the privacy policy treats meal text and body metrics as sensitive,
/// so a report carries the stack, device/app metadata and the opaque account
/// id — never a request body, a log line, or an email ([scrubEvent]).
library;

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

import '../env/env.dart';

/// True only when a DSN was supplied at build time.
bool get monitoringEnabled => Env.sentryDsn.isNotEmpty;

/// Run [appRunner] under Sentry when enabled, so errors thrown during startup
/// (Supabase init, Google sign-in init) are reported too. Sentry installs the
/// `FlutterError.onError` / `PlatformDispatcher.onError` hooks itself —
/// `installKalloErrorWidget` deliberately leaves them free for this.
Future<void> runWithMonitoring(FutureOr<void> Function() appRunner) async {
  if (!monitoringEnabled) {
    await appRunner();
    return;
  }
  await SentryFlutter.init((options) {
    options
      ..dsn = Env.sentryDsn
      ..sendDefaultPii = false
      // 10% of sessions traced: enough to spot slow screens, far inside the
      // free tier.
      ..tracesSampleRate = 0.1
      // `debugPrint` lines can carry meal text; never turn them into
      // breadcrumbs.
      ..enablePrintBreadcrumbs = false
      ..beforeSend = (event, hint) => scrubEvent(event);
  }, appRunner: appRunner);
}

/// Strip anything user-entered from an event before it leaves the device.
@visibleForTesting
SentryEvent scrubEvent(SentryEvent event) {
  final request = event.request;
  if (request != null) {
    // Rebuilt rather than edited: body, cookies, headers and query string are
    // dropped, and the URL keeps only its origin — an API path can carry a
    // share id, group id or invite slug.
    final url = Uri.tryParse(request.url ?? '');
    event.request = SentryRequest(
      method: request.method,
      url:
          url == null || !url.hasAuthority
              ? null
              : '${url.scheme}://${url.authority}',
    );
  }
  final user = event.user;
  if (user != null) {
    event.user = user.id == null ? null : SentryUser(id: user.id);
  }
  return event;
}

/// Tag subsequent reports with the signed-in account (opaque id only).
void setMonitoringUser(String? userId) {
  if (!monitoringEnabled) return;
  Sentry.configureScope(
    (scope) => scope.setUser(userId == null ? null : SentryUser(id: userId)),
  );
}
