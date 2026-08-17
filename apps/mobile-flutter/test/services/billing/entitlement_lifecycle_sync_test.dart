import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/services/http/api_client.dart';
import 'package:kallo_mobile/services/billing/activation_pending.dart';
import 'package:kallo_mobile/services/billing/entitlement_lifecycle_sync.dart';
import 'package:kallo_mobile/services/billing/entitlements_provider.dart';

void main() {
  const userA = '11111111-1111-1111-1111-111111111111';
  const userB = '22222222-2222-2222-2222-222222222222';

  test('reconciles on launch and again after the resume interval', () async {
    var now = DateTime.utc(2026, 7, 29, 9);
    var calls = 0;
    final sync = EntitlementLifecycleSync(
      reconcile: (_) async {
        calls += 1;
        return true;
      },
      minimumInterval: const Duration(minutes: 5),
      now: () => now,
    );

    await sync.synchronize(userA);
    await sync.synchronize(userA);
    expect(calls, 1);

    now = now.add(const Duration(minutes: 5));
    await sync.synchronize(userA);
    expect(calls, 2);
  });

  test(
    'failed lifecycle reconciliation retries after the bounded interval',
    () async {
      var now = DateTime.utc(2026, 7, 29, 9);
      var calls = 0;
      final sync = EntitlementLifecycleSync(
        reconcile: (_) async {
          calls += 1;
          return calls > 1;
        },
        minimumInterval: const Duration(minutes: 15),
        now: () => now,
      );

      await sync.synchronize(userA);
      await sync.synchronize(userA);
      expect(calls, 1);

      now = now.add(const Duration(minutes: 15));
      await sync.synchronize(userA);

      expect(calls, 2);
    },
  );

  test(
    'a hung lifecycle reconciliation times out and observes cadence',
    () async {
      final hung = Completer<bool>();
      var now = DateTime.utc(2026, 7, 29, 9);
      var calls = 0;
      final sync = EntitlementLifecycleSync(
        reconcile: (_) {
          calls += 1;
          return calls == 1 ? hung.future : Future<bool>.value(true);
        },
        minimumInterval: const Duration(minutes: 15),
        operationTimeout: const Duration(milliseconds: 5),
        now: () => now,
      );

      await sync.synchronize(userA);
      await sync.synchronize(userA);
      expect(calls, 1);

      now = now.add(const Duration(minutes: 15));
      await sync.synchronize(userA);

      expect(calls, 2);
      hung.complete(true);
    },
  );

  test('waits for the auth provider graph before reconciling', () async {
    var authGraphSettled = false;
    final sync = EntitlementLifecycleSync(
      reconcile: (_) async {
        expect(authGraphSettled, isTrue);
        return true;
      },
    );

    final reconciliation = sync.synchronize(userA);
    authGraphSettled = true;
    await reconciliation;
  });

  test('account switch is not blocked by the previous account', () async {
    final accountA = Completer<bool>();
    final accountB = Completer<bool>();
    final calls = <String>[];
    final sync = EntitlementLifecycleSync(
      reconcile: (userId) {
        calls.add(userId);
        return userId == userA ? accountA.future : accountB.future;
      },
    );

    final staleA = sync.synchronize(userA);
    await Future<void>.delayed(Duration.zero);
    final currentB = sync.synchronize(userB);
    await Future<void>.delayed(Duration.zero);
    expect(calls, [userA, userB]);

    accountA.complete(true);
    await staleA;
    accountB.complete(true);
    await currentB;

    await sync.synchronize(userB);
    expect(calls, [userA, userB]);
  });

  test('sign-out resets the cadence for a same-account sign-in', () async {
    var calls = 0;
    final sync = EntitlementLifecycleSync(
      reconcile: (_) async {
        calls += 1;
        return true;
      },
    );

    await sync.synchronize(userA);
    await sync.synchronize(null);
    await sync.synchronize(userA);

    expect(calls, 2);
  });

  test(
    'waits for the cold GET, refreshes, then heals when requested',
    () async {
      final api = _LifecycleApi(reconciliationRequired: true);
      final container = _makeContainer(api);
      final sync = container.read(entitlementLifecycleSyncProvider);

      final operation = sync.synchronize(userA);
      await Future<void>.delayed(Duration.zero);
      await container.pump();
      await Future<void>.delayed(const Duration(milliseconds: 1));
      await container.pump();
      expect(api.postCalls, 0);

      api.initialGet.complete(_entitlement(reconciliationRequired: true));
      await operation;

      expect(api.getCalls, 2);
      expect(api.postCalls, 1);
      expect(
        container.read(entitlementsProvider(userA)).valueOrNull?.isPremium,
        isTrue,
      );
    },
  );

  test('healthy snapshots never spend a RevenueCat reconciliation', () async {
    final api = _LifecycleApi(reconciliationRequired: false);
    final container = _makeContainer(api);
    final sync = container.read(entitlementLifecycleSyncProvider);

    final operation = sync.synchronize(userA);
    api.initialGet.complete(_entitlement());
    await operation;

    expect(api.getCalls, 2);
    expect(api.postCalls, 0);
  });

  test('a purchase the server never projected still recovers', () async {
    // `reconciliationRequired` is derived from existing grant rows, so a first
    // purchase that never projected leaves no rows and no signal. Without the
    // local marker this user would sit on free forever.
    final api = _LifecycleApi(reconciliationRequired: false);
    final pendingStore = _FakePendingStore(pending: true);
    final container = _makeContainer(api, pendingStore: pendingStore);
    final sync = container.read(entitlementLifecycleSyncProvider);

    final operation = sync.synchronize(userA);
    api.initialGet.complete(_entitlement());
    await operation;

    expect(api.postCalls, 1);
    // Recovery found the purchase, so the signal is spent.
    expect(pendingStore.pending, isFalse);
  });

  test('a recovery that still finds nothing keeps the signal', () async {
    // The provider can still be ingesting the transaction. Retiring the marker
    // on the first miss would strand a paying user on free forever.
    final api = _LifecycleApi(
      reconciliationRequired: false,
      reconcileYieldsPremium: false,
    );
    final pendingStore = _FakePendingStore(pending: true);
    final container = _makeContainer(api, pendingStore: pendingStore);
    final sync = container.read(entitlementLifecycleSyncProvider);

    final operation = sync.synchronize(userA);
    api.initialGet.complete(_entitlement());
    await operation;

    expect(api.postCalls, 1);
    expect(pendingStore.pending, isTrue);
    expect(pendingStore.attempts, 1);
  });
}

ProviderContainer _makeContainer(
  _LifecycleApi api, {
  _FakePendingStore? pendingStore,
}) {
  final container = ProviderContainer(
    overrides: [
      apiClientProvider.overrideWithValue(api),
      entitlementsUserIdProvider.overrideWithValue(
        '11111111-1111-1111-1111-111111111111',
      ),
      // Keeps these tests off the platform channel; the real store is keychain
      // backed and silently unavailable in a plain unit test.
      activationPendingStoreProvider.overrideWithValue(
        pendingStore ?? _FakePendingStore(),
      ),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

class _FakePendingStore implements ActivationPendingStore {
  _FakePendingStore({this.pending = false});

  bool pending;
  var clears = 0;
  var attempts = 0;

  @override
  Future<void> mark(String userId) async => pending = true;

  @override
  Future<void> clear(String userId) async {
    pending = false;
    clears += 1;
  }

  @override
  Future<bool> isPending(String userId) async => pending;

  @override
  Future<void> recordRecoveryAttempt(String userId) async => attempts += 1;
}

class _LifecycleApi extends ApiClient {
  _LifecycleApi({
    required this.reconciliationRequired,
    this.reconcileYieldsPremium = true,
  });

  final bool reconciliationRequired;

  /// False models a provider that has not ingested the transaction yet.
  final bool reconcileYieldsPremium;
  final initialGet = Completer<Map<String, dynamic>>();
  var getCalls = 0;
  var postCalls = 0;

  @override
  Future<T> get<T>(String path) {
    getCalls += 1;
    if (getCalls == 1) {
      return initialGet.future.then((value) => value as T);
    }
    return Future<T>.value(
      _entitlement(reconciliationRequired: reconciliationRequired) as T,
    );
  }

  @override
  Future<T> post<T>(String path, [Object? body]) {
    postCalls += 1;
    return Future<T>.value(
      _entitlement(premium: reconcileYieldsPremium) as T,
    );
  }
}

Map<String, dynamic> _entitlement({
  bool premium = false,
  bool reconciliationRequired = false,
}) => {
  'tier': premium ? 'premium' : 'free',
  'purchasesEnabled': true,
  'reconciliationRequired': reconciliationRequired,
  'isLifetime': false,
  'willRenew': premium,
  'source': premium ? 'revenuecat' : null,
  'hasActiveSubscription': premium,
  'trial': {'active': false, 'endsAt': null, 'daysRemaining': 0},
  'features': {
    'ai_analysis': {
      'allowed': premium,
      'reason': premium ? 'entitled' : 'not_entitled',
    },
  },
};
