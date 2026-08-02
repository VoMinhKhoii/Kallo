import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'activation_pending.dart';
import 'entitlements_provider.dart';

typedef ReconcileEntitlements = Future<bool> Function(String userId);

/// Keeps server-owned entitlement state aligned with RevenueCat across app
/// launches and resumes.
///
/// Production webhooks remain the primary update path. This bounded recovery
/// path first refreshes the server snapshot and contacts RevenueCat only when
/// the server detects a delayed/missed renewal webhook (including accelerated
/// TestFlight sandbox renewals).
class EntitlementLifecycleSync {
  EntitlementLifecycleSync({
    required ReconcileEntitlements reconcile,
    Duration minimumInterval = const Duration(minutes: 15),
    Duration operationTimeout = const Duration(seconds: 65),
    DateTime Function()? now,
  }) : _reconcile = reconcile,
       _minimumInterval = minimumInterval,
       _operationTimeout = operationTimeout,
       _now = now ?? DateTime.now;

  final ReconcileEntitlements _reconcile;
  final Duration _minimumInterval;
  final Duration _operationTimeout;
  final DateTime Function() _now;

  String? _ownerUserId;
  DateTime? _lastAttemptAt;
  Future<void>? _inFlight;
  int _generation = 0;

  /// Reconciles once per launch/account and at a bounded cadence on resume.
  ///
  /// Failures are intentionally swallowed: entitlement access remains
  /// server-authoritative and the next lifecycle signal can retry immediately.
  Future<void> synchronize(String? userId) {
    if (userId == null) {
      _resetOwner();
      return Future<void>.value();
    }

    if (_ownerUserId != userId) {
      _ownerUserId = userId;
      _lastAttemptAt = null;
      _inFlight = null;
      _generation += 1;
    }

    final active = _inFlight;
    if (active != null) return active;

    final now = _now();
    final lastAttempt = _lastAttemptAt;
    if (lastAttempt != null) {
      final elapsed = now.difference(lastAttempt);
      if (!elapsed.isNegative && elapsed < _minimumInterval) {
        return Future<void>.value();
      }
    }

    _lastAttemptAt = now;
    final generation = _generation;
    final operation = _run(userId, generation);
    _inFlight = operation;
    return operation;
  }

  Future<void> _run(String userId, int generation) async {
    // Session listeners run while Riverpod is still propagating the auth
    // change to derived providers. Let that graph settle before the
    // entitlement controller verifies that this user owns the operation.
    await Future<void>.delayed(Duration.zero);
    final isCurrent = _generation == generation && _ownerUserId == userId;
    if (isCurrent) {
      try {
        await _reconcile(userId).timeout(_operationTimeout);
      } catch (_) {
        // A lifecycle refresh must never take down the authenticated app shell.
      } finally {
        if (_generation == generation && _ownerUserId == userId) {
          _inFlight = null;
        }
      }
    }
  }

  void _resetOwner() {
    _ownerUserId = null;
    _lastAttemptAt = null;
    _inFlight = null;
    _generation += 1;
  }
}

final entitlementLifecycleSyncProvider = Provider<EntitlementLifecycleSync>((
  ref,
) {
  return EntitlementLifecycleSync(
    reconcile: (userId) async {
      final provider = entitlementsProvider(userId);
      final subscription = ref.listen(provider, (_, _) {});

      try {
        // Let the provider's initial GET settle before starting another
        // operation. The temporary subscription keeps this auto-dispose
        // provider alive across network frames, preventing a recreated build
        // GET from racing the recovery flow. If the GET fails,
        // refreshSnapshot below is still allowed to recover.
        try {
          await ref.read(provider.future);
        } catch (_) {
          // The explicit refresh below owns retry behavior.
        }

        final controller = ref.read(provider.notifier);
        final snapshot = await controller.refreshSnapshot();
        if (snapshot == null) return false;

        final pendingStore = ref.read(activationPendingStoreProvider);
        if (snapshot.isPremium) {
          await pendingStore.clear(userId);
          if (!snapshot.reconciliationRequired) return true;
        }

        // The server cannot flag a first purchase that never projected — it has
        // no grant row to derive staleness from. The local marker covers
        // exactly that hole; everything else keys on the server's own signal.
        if (!snapshot.reconciliationRequired &&
            !await pendingStore.isPending(userId)) {
          return true;
        }

        final recovered = await controller.reconcile();
        // Either it landed, or the provider agrees there is nothing to grant.
        // Both end the retry; a marker that survives its own recovery attempt
        // would spend reconcile budget on every launch for a day.
        await pendingStore.clear(userId);
        return recovered != null;
      } finally {
        subscription.close();
      }
    },
  );
});
