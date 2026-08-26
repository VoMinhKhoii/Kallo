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

import '../http/api_client.dart';
import '../auth/session_provider.dart';
import 'entitlement_state.dart';

final entitlementRequestTimeoutProvider = Provider<Duration>(
  (_) => const Duration(seconds: 20),
);

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
    final json = await api
        .get<Map<String, dynamic>>('/api/v1/account/entitlements')
        .timeout(ref.read(entitlementRequestTimeoutProvider));
    return EntitlementState.fromJson(json);
  }

  Future<EntitlementState> _reconcile() async {
    final api = ref.read(apiClientProvider);
    final json = await api
        .post<Map<String, dynamic>>('/api/v1/account/entitlements/reconcile')
        .timeout(ref.read(entitlementRequestTimeoutProvider));
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
      if (!_disposed) {
        state = const AsyncData(EntitlementState.free);
      }
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
      if (!_disposed) {
        state = const AsyncData(EntitlementState.free);
      }
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

        // Reconcile with the provider at most twice. Everything between is a
        // local entitlement read so a slow webhook does not amplify into
        // repeated RevenueCat API calls.
        Future<bool?> reconcileOnce() async {
          final budget = deadline.difference(DateTime.now());
          if (budget <= Duration.zero) return null;
          final previous = state.valueOrNull;
          final reconciled = await AsyncValue.guard(
            () => _reconcile().timeout(budget),
          );
          if (!_isCurrent(operation)) return null;
          state =
              reconciled.hasError && previous != null
                  ? AsyncData(previous)
                  : reconciled;
          return reconciled.valueOrNull?.isPremium ?? false;
        }

        final first = await reconcileOnce();
        if (first == null) return false;
        if (first) return true;

        // The first reconcile fires the instant the store call resolves, which
        // is the moment the provider is LEAST likely to have recorded the
        // purchase — an observed sandbox purchase landed ~5s after the
        // reconcile that preceded it, leaving that call to find nothing and the
        // rest of the window re-reading a database nobody had written to. Spend
        // one more provider call before giving up, so activation does not
        // depend on the webhook winning a race.
        var retried = false;
        final retryAt = timeout ~/ 2;
        // Never spend the retry on a sliver of window it cannot use: if the
        // first reconcile ate most of the budget there is no point paying for
        // a second call whose response cannot arrive in time.
        final retryFloor = timeout ~/ 4;

        while (DateTime.now().isBefore(deadline)) {
          final remaining = deadline.difference(DateTime.now());
          if (remaining <= Duration.zero) break;
          await Future<void>.delayed(
            remaining < interval ? remaining : interval,
          );
          if (!_isCurrent(operation)) return false;
          final requestBudget = deadline.difference(DateTime.now());
          if (requestBudget <= Duration.zero) break;

          if (!retried &&
              requestBudget <= retryAt &&
              requestBudget >= retryFloor) {
            retried = true;
            final again = await reconcileOnce();
            if (again == null) return false;
            if (again) return true;
            continue;
          }

          final previous = state.valueOrNull;
          final snapshot = await AsyncValue.guard(
            () => _fetch().timeout(requestBudget),
          );
          if (!_isCurrent(operation)) return false;
          state =
              snapshot.hasError && previous != null
                  ? AsyncData(previous)
                  : snapshot;
          if (snapshot.valueOrNull?.isPremium ?? false) return true;
        }

        return false;
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

/// Whether the settings root emits the subscription group.
///
/// The predicate lives here rather than inside `SubscriptionSection` because
/// the PARENT owns the gap above a group (`.agents/skills/kallo-design/mobile.md`,
/// "A card never carries a bottom margin"). A section that hid itself internally
/// left the parent's 24px gaps behind on both sides as a 48px void — which is
/// exactly what shipped before this provider existed.
///
/// A null snapshot means the fetch is still in flight: reserve the slot rather
/// than collapsing it, so the group doesn't pop in and shove the list down.
final subscriptionSectionVisibleProvider = Provider.autoDispose<bool>((ref) {
  final userId = ref.watch(entitlementsUserIdProvider);
  final entitlement = ref.watch(entitlementsProvider(userId)).valueOrNull;
  if (entitlement == null) return true;
  return entitlement.purchasesEnabled || entitlement.isPremium;
});
