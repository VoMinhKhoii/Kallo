import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Web counterpart: `components/billing/activation-pending.ts`. Keep the two in
/// step.
///
/// Records that a store purchase completed while the server had not yet
/// projected a grant, so the launch/resume recovery path can force one provider
/// reconcile on a later run.
///
/// This exists because the server cannot infer the state.
/// `reconciliationRequired` is derived from existing grant rows (see
/// `lib/entitlements/service.ts`), so a user whose FIRST purchase never
/// projected has no rows, no winning grant, and therefore no signal at all —
/// the one failure the automatic recovery path cannot see. Normally the signed
/// webhook writes that grant within seconds; if it is lost or dead-lettered,
/// this marker is what stops a paying customer sitting on the free tier.
///
/// Best-effort and never authoritative: it only ever buys ONE extra
/// authenticated reconcile. Access remains server-owned.
abstract class ActivationPendingStore {
  /// Call BEFORE handing control to the store, not after it returns: the
  /// likeliest interruption is a purchase whose app is backgrounded or killed
  /// before the SDK future completes.
  Future<void> mark(String userId);
  Future<void> clear(String userId);
  Future<bool> isPending(String userId);

  /// Count one provider recovery that did NOT yield premium. Retires the marker
  /// once the attempt budget is spent.
  Future<void> recordRecoveryAttempt(String userId);
}

/// Long enough to survive a provider outage or a webhook replayed the next day;
/// short enough that an abandoned marker cannot spend reconcile budget forever.
const activationPendingMaxAge = Duration(hours: 24);

/// Bounded so a permanently unprojectable purchase cannot spend reconcile
/// budget indefinitely. Three attempts across a >=15-minute cadence outlives a
/// lagging provider while staying far below the 20/hr and 100/day ceilings.
const activationPendingMaxAttempts = 3;

class SecureActivationPendingStore implements ActivationPendingStore {
  SecureActivationPendingStore({
    FlutterSecureStorage? storage,
    DateTime Function()? now,
  }) : _storage = storage ?? const FlutterSecureStorage(),
       _now = now ?? DateTime.now;

  static const _keyPrefix = 'kallo.billing.activationPending.';

  final FlutterSecureStorage _storage;
  final DateTime Function() _now;

  String _key(String userId) => '$_keyPrefix$userId';

  @override
  Future<void> mark(String userId) async {
    await _write(userId, _now().millisecondsSinceEpoch, 0);
  }

  Future<void> _write(String userId, int markedAtMs, int attempts) async {
    try {
      await _storage.write(
        key: _key(userId),
        value: jsonEncode({'at': markedAtMs, 'attempts': attempts}),
      );
    } catch (_) {
      // Storage unavailable — recovery degrades to the webhook.
    }
  }

  /// Returns `(markedAtMs, attempts)` or null. Tolerates the earlier bare
  /// timestamp format so an in-flight activation survives an app upgrade.
  Future<(int, int)?> _read(String userId) async {
    try {
      final raw = await _storage.read(key: _key(userId));
      if (raw == null) return null;
      if (raw.startsWith('{')) {
        final decoded = jsonDecode(raw);
        if (decoded is Map) {
          final at = decoded['at'];
          final attempts = decoded['attempts'];
          if (at is int) return (at, attempts is int ? attempts : 0);
        }
        return null;
      }
      final legacy = int.tryParse(raw);
      return legacy == null ? null : (legacy, 0);
    } catch (_) {
      return null;
    }
  }

  @override
  Future<void> clear(String userId) async {
    try {
      await _storage.delete(key: _key(userId));
    } catch (_) {
      // Ignored; a stale marker expires on its own.
    }
  }

  @override
  Future<bool> isPending(String userId) async {
    final record = await _read(userId);
    if (record == null) return false;
    final (markedAtMs, attempts) = record;
    final markedAt = DateTime.fromMillisecondsSinceEpoch(markedAtMs);
    // A negative age means clock skew, not expiry — keep the marker.
    if (_now().difference(markedAt) >= activationPendingMaxAge ||
        attempts >= activationPendingMaxAttempts) {
      await clear(userId);
      return false;
    }
    return true;
  }

  @override
  Future<void> recordRecoveryAttempt(String userId) async {
    final record = await _read(userId);
    if (record == null) return;
    final (markedAtMs, attempts) = record;
    final next = attempts + 1;
    if (next >= activationPendingMaxAttempts) {
      await clear(userId);
      return;
    }
    await _write(userId, markedAtMs, next);
  }
}

final activationPendingStoreProvider = Provider<ActivationPendingStore>(
  (ref) => SecureActivationPendingStore(),
);
