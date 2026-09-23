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

  /// Whether this build carries a PostHog key — the one place that decides
  /// analytics is on, for both [setup] and [analyticsProvider].
  static bool get configured => Env.posthogKey.isNotEmpty;

  /// Start the SDK. Call once at boot, before `runApp`, AFTER the Supabase
  /// session is restored; a no-op without a key. The native auto-init is
  /// switched off in `AndroidManifest.xml` and `Info.plist` so this is the
  /// only place PostHog starts.
  ///
  /// [signedInUserId] is the restored session's user (null when signed out).
  /// PostHog restores its OWN persisted identity on setup, which may belong to
  /// an account whose session expired or was revoked while the app was
  /// closed — and the SDK cannot tell us whether it is identified. So identity
  /// is reconciled here, before anything is captured: identify the current
  /// user, or reset. The cost of the reset is a fresh anonymous id per
  /// signed-out launch; with `identifiedOnly` person profiles that creates no
  /// person, only a new anonymous distinct id.
  static Future<void> setup({required String? signedInUserId}) async {
    if (!configured) return;
    final config =
        PostHogConfig(Env.posthogKey)
          ..host = Env.posthogHost
          // Off: "Application Opened" would fire during setup, under whatever
          // identity was persisted, before the reconciliation below.
          ..captureApplicationLifecycleEvents = false
          ..personProfiles = PostHogPersonProfiles.identifiedOnly
          ..sessionReplay = false
          ..surveys = false
          // Off: `/flags` at setup would go out under the PERSISTED identity,
          // before the reconciliation below. No feature flags are used.
          ..preloadFeatureFlags = false
          // Off: push capture sends the APNs token and notification payloads
          // (meal previews, ids) outside the typed event list. The opened-push
          // opt-out is also in Info.plist, for cold starts before Dart runs.
          ..capturePushNotificationSubscriptions = false
          ..capturePushNotificationOpened = false;
    // On by default (iOS): `$rageclick` carries element-chain labels, which
    // can be on-screen meal text.
    config.rageClickConfig.enabled = false;
    await Posthog().setup(config);
    if (signedInUserId != null) {
      await Posthog().identify(userId: signedInUserId);
    } else {
      await Posthog().reset();
    }
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
  return Analytics._(enabled: Analytics.configured);
});
