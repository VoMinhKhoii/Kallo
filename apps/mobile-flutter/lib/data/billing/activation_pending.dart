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
  Future<void> mark(String userId);
  Future<void> clear(String userId);
  Future<bool> isPending(String userId);
}

/// Long enough to survive a provider outage or a webhook replayed the next day;
/// short enough that an abandoned marker cannot spend reconcile budget forever.
const activationPendingMaxAge = Duration(hours: 24);

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
    try {
      await _storage.write(
        key: _key(userId),
        value: _now().millisecondsSinceEpoch.toString(),
      );
    } catch (_) {
      // Storage unavailable — recovery degrades to the webhook.
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
    try {
      final raw = await _storage.read(key: _key(userId));
      if (raw == null) return false;
      final markedAtMs = int.tryParse(raw);
      if (markedAtMs == null) {
        await clear(userId);
        return false;
      }
      final markedAt = DateTime.fromMillisecondsSinceEpoch(markedAtMs);
      // A negative age means clock skew, not expiry — keep the marker.
      if (_now().difference(markedAt) >= activationPendingMaxAge) {
        await clear(userId);
        return false;
      }
      return true;
    } catch (_) {
      return false;
    }
  }
}

final activationPendingStoreProvider = Provider<ActivationPendingStore>(
  (ref) => SecureActivationPendingStore(),
);
