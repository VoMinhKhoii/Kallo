/// PostHog product analytics (EU cloud), behind a thin no-op-safe facade.
///
/// Env-gated: with no `POSTHOG_KEY` dart-define nothing is constructed and
/// every call is a complete no-op (no platform channel, no network, no
/// storage) — which is also what keeps widget tests channel-free.
///
/// Deliberately narrow, matching the web client (`lib/infra/analytics/` at the
/// repo root): no session replay, no surveys, person profiles only for
/// signed-in users, and only the typed events in `analytics_events.dart` —
/// never meal text or body metrics.
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:posthog_flutter/posthog_flutter.dart';

import '../env/env.dart';

/// Analytics facade. All methods are safe no-ops when analytics is disabled.
class Analytics {
  Analytics._({required this.enabled});

  /// True only when a PostHog key is configured.
  final bool enabled;

  /// Start the SDK. Call once at boot, before `runApp`; a no-op without a key.
  /// The native auto-init is switched off in `AndroidManifest.xml` and
  /// `Info.plist` so this is the only place PostHog starts.
  static Future<void> setup() async {
    if (Env.posthogKey.isEmpty) return;
    final config =
        PostHogConfig(Env.posthogKey)
          ..host = Env.posthogHost
          ..captureApplicationLifecycleEvents = true
          ..personProfiles = PostHogPersonProfiles.identifiedOnly
          ..sessionReplay = false
          ..surveys = false;
    await Posthog().setup(config);
  }

  /// Screen view. [name] is a route PATTERN (`/circle/:shareId`), never a
  /// concrete location — see `screen_tracking.dart`.
  void screen(String name) {
    if (!enabled) return;
    unawaited(Posthog().screen(screenName: name));
  }

  /// Product event capture.
  void capture(String event, {Map<String, Object>? properties}) {
    if (!enabled) return;
    unawaited(Posthog().capture(eventName: event, properties: properties));
  }

  /// Associate subsequent events with a user (opaque Supabase id only).
  void identify(String distinctId) {
    if (!enabled) return;
    unawaited(Posthog().identify(userId: distinctId));
  }

  /// Clear identity on sign-out.
  void reset() {
    if (!enabled) return;
    unawaited(Posthog().reset());
  }
}

/// Singleton [Analytics]. No-op unless [Env.posthogKey] is set.
final analyticsProvider = Provider<Analytics>((ref) {
  return Analytics._(enabled: Env.posthogKey.isNotEmpty);
});
