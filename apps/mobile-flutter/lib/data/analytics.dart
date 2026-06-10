/// PostHog analytics — thin, no-op-safe stub.
///
/// Port of `apps/mobile/src/lib/analytics.tsx`. The RN provider is env-gated:
/// with no `EXPO_PUBLIC_POSTHOG_KEY` it constructs nothing and every call is a
/// complete no-op (no network, no storage). This stub preserves that contract.
///
/// NOTE: there is no `posthog_flutter` dependency wired in yet. This is a
/// deliberate STUB — when [Env.posthogKey] is empty (the default) it does
/// nothing. When a key IS present it currently only logs in debug, so callsites
/// can be written today; swapping in the real PostHog SDK later is a localized
/// change inside [Analytics] with no callsite churn.
library;

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'env.dart';

/// Analytics facade. Mirror of the events the RN app emits (`screen`, plus
/// `capture`/`identify` for product events). All methods are safe no-ops when
/// analytics is disabled.
class Analytics {
  Analytics._({required this.enabled});

  /// True only when a PostHog key is configured (RN parity: key present).
  final bool enabled;

  /// Manual screen tracking, mirroring the RN `ScreenTracker` that emitted
  /// `posthog.screen(pathname)` on every route change. Wire this to the
  /// go_router observer when a screen changes.
  void screen(String name, {Map<String, Object?>? properties}) {
    if (!enabled) return;
    _debugLog('screen', {'name': name, ...?properties});
  }

  /// Product event capture.
  void capture(String event, {Map<String, Object?>? properties}) {
    if (!enabled) return;
    _debugLog('capture', {'event': event, ...?properties});
  }

  /// Associate subsequent events with a user (e.g. after sign-in).
  void identify(String distinctId, {Map<String, Object?>? properties}) {
    if (!enabled) return;
    _debugLog('identify', {'distinctId': distinctId, ...?properties});
  }

  /// Clear identity on sign-out.
  void reset() {
    if (!enabled) return;
    _debugLog('reset', const {});
  }

  void _debugLog(String op, Map<String, Object?> data) {
    if (kDebugMode) {
      debugPrint('[analytics:$op] $data');
    }
  }
}

/// Singleton [Analytics]. No-op unless [Env.posthogKey] is set — exactly the
/// RN behavior where an absent key means the provider renders children unchanged.
final analyticsProvider = Provider<Analytics>((ref) {
  return Analytics._(enabled: Env.posthogKey.isNotEmpty);
});
