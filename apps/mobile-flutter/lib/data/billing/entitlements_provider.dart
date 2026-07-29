/// Entitlement state — the SERVER-authoritative subscription status that drives
/// every gating decision in the app.
///
/// Fetches `GET /api/v1/account/entitlements` through the existing [ApiClient].
/// The RC SDK is only for purchase/restore UX; this endpoint is the source of
/// truth for tier / trial / feature access. After a purchase or restore the
/// client polls [pollUntilPremium] with backoff (the server learns via the RC
/// webhook — the client must never self-grant).
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api_client.dart';
import '../session_provider.dart';
import 'entitlement_state.dart';

/// Fetches + caches the server entitlement snapshot. `refresh()` re-fetches;
/// `pollUntilPremium()` runs the post-purchase backoff poll.
class EntitlementsController
    extends AutoDisposeFamilyAsyncNotifier<EntitlementState, String?> {
  String? _ownerUserId;
  bool _disposed = false;
  int _operationGeneration = 0;
  int _authoritativeOperations = 0;
  Completer<void>? _authoritativeIdle;

  @override
  Future<EntitlementState> build(String? userId) async {
    _disposed = false;
    _ownerUserId = userId;
    ref.onDispose(() => _disposed = true);

    if (userId == null) {
      return EntitlementState.free;
    }

    final authoritative = _authoritativeIdle;
    if (authoritative != null) {
      await authoritative.future;
      return state.valueOrNull ?? EntitlementState.free;
    }

    final operation = ++_operationGeneration;
    try {
      final snapshot = await _fetch();
      if (!_isCurrent(operation)) {
        return state.valueOrNull ?? EntitlementState.free;
      }
      return snapshot;
    } catch (_) {
      if (!_isCurrent(operation)) {
        return state.valueOrNull ?? EntitlementState.free;
      }
      rethrow;
    }
  }

  Future<EntitlementState> _fetch() async {
    final api = ref.read(apiClientProvider);
    final json = await api.get<Map<String, dynamic>>(
      '/api/v1/account/entitlements',
    );
    return EntitlementState.fromJson(json);
  }

  Future<EntitlementState> _reconcile() async {
    final api = ref.read(apiClientProvider);
    final json = await api.post<Map<String, dynamic>>(
      '/api/v1/account/entitlements/reconcile',
    );
    return EntitlementState.fromJson(json);
  }

  /// Re-fetch the snapshot, surfacing loading/error through the AsyncValue.
  Future<void> refresh() async {
    state = const AsyncValue<EntitlementState>.loading().copyWithPrevious(
      state,
    );
    await refreshSnapshot();
  }

  /// Fetch the server-owned entitlement state without asking RevenueCat to
  /// reconcile. Use this for pre-purchase commerce checks; provider
  /// reconciliation is reserved for recovery and post-store verification.
  ///
  /// Returns `null` on a transport/server failure so callers can distinguish
  /// "could not verify" from an explicit `purchasesEnabled: false`.
  Future<EntitlementState?> refreshSnapshot() async {
    final authoritative = _authoritativeIdle;
    if (authoritative != null) {
      await authoritative.future;
      return state.valueOrNull;
    }

    final operation = _captureOperation();
    if (operation == null) {
      state = const AsyncData(EntitlementState.free);
      return EntitlementState.free;
    }

    return _keepAliveWhile(() async {
      final previous = state.valueOrNull;
      try {
        final snapshot = await _fetch();
        if (!_isCurrent(operation)) return null;

        state = AsyncData(snapshot);
        return snapshot;
      } catch (error, stackTrace) {
        if (!_isCurrent(operation)) return null;

        // A pre-purchase safety refresh must not erase the last known-good
        // entitlement snapshot. The caller still receives null and blocks this
        // attempt, while the real screen keeps its packages available to retry.
        state =
            previous == null
                ? AsyncError(error, stackTrace)
                : AsyncData(previous);
        return null;
      }
    });
  }

  Future<EntitlementState?> reconcile() async {
    final operation = _captureAuthoritativeOperation();
    if (operation == null) {
      state = const AsyncData(EntitlementState.free);
      return EntitlementState.free;
    }

    try {
      return await _keepAliveWhile(() async {
        final previous = state.valueOrNull;
        try {
          final snapshot = await _reconcile();
          if (!_isCurrent(operation)) return null;

          state = AsyncData(snapshot);
          return snapshot;
        } catch (error, stackTrace) {
          if (!_isCurrent(operation)) return null;

          state =
              previous == null
                  ? AsyncError(error, stackTrace)
                  : AsyncData(previous);
          return null;
        }
      });
    } finally {
      _endAuthoritativeOperation();
    }
  }

  /// After a successful purchase/restore, poll the server until the tier flips
  /// to premium (the server learns asynchronously via the RC webhook). Polls
  /// every [interval] up to [timeout]; updates [state] as it goes. Returns
  /// `true` once premium is observed, `false` if the window elapses first.
  ///
  /// The client NEVER self-grants — it only reflects what the server reports.
  Future<bool> pollUntilPremium({
    Duration interval = const Duration(seconds: 2),
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final operation = _captureAuthoritativeOperation();
    if (operation == null) return false;

    try {
      return await _keepAliveWhile(() async {
        final deadline = DateTime.now().add(timeout);

        // Reconcile with the provider once after the store action. Follow-up
        // checks are local entitlement reads so a slow webhook does not
        // amplify into repeated RevenueCat API calls.
        final reconciled = await AsyncValue.guard(_reconcile);
        if (!_isCurrent(operation)) return false;
        state = reconciled;
        if (reconciled.valueOrNull?.isPremium ?? false) return true;

        while (DateTime.now().isBefore(deadline)) {
          final remaining = deadline.difference(DateTime.now());
          if (remaining <= Duration.zero) break;
          await Future<void>.delayed(
            remaining < interval ? remaining : interval,
          );
          if (!_isCurrent(operation)) return false;

          final snapshot = await AsyncValue.guard(_fetch);
          if (!_isCurrent(operation)) return false;
          state = snapshot;
          if (snapshot.valueOrNull?.isPremium ?? false) return true;
        }

        return _isCurrent(operation) && (state.valueOrNull?.isPremium ?? false);
      });
    } finally {
      _endAuthoritativeOperation();
    }
  }

  Future<T> _keepAliveWhile<T>(Future<T> Function() operation) async {
    final keepAlive = ref.keepAlive();
    try {
      return await operation();
    } finally {
      keepAlive.close();
    }
  }

  int? _captureOperation() {
    if (_disposed) return null;
    final userId = ref.read(entitlementsUserIdProvider);
    if (userId == null || userId != _ownerUserId) return null;

    return ++_operationGeneration;
  }

  int? _captureAuthoritativeOperation() {
    final operation = _captureOperation();
    if (operation == null) return null;

    _authoritativeOperations += 1;
    _authoritativeIdle ??= Completer<void>();
    return operation;
  }

  void _endAuthoritativeOperation() {
    _authoritativeOperations -= 1;
    if (_authoritativeOperations != 0) return;

    _authoritativeIdle?.complete();
    _authoritativeIdle = null;
  }

  bool _isCurrent(int operation) {
    return !_disposed &&
        operation == _operationGeneration &&
        _ownerUserId == ref.read(entitlementsUserIdProvider);
  }
}

/// The authenticated identity that owns the cached entitlement snapshot.
/// Watching it makes auth changes invalidate the snapshot immediately.
final entitlementsUserIdProvider = Provider<String?>((ref) {
  return ref.watch(currentSessionProvider)?.user.id;
});

final entitlementsProvider = AsyncNotifierProvider.autoDispose
    .family<EntitlementsController, EntitlementState, String?>(
      EntitlementsController.new,
    );
