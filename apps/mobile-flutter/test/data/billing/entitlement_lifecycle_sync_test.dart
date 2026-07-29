import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nham_mobile/data/api_client.dart';
import 'package:nham_mobile/data/billing/entitlement_lifecycle_sync.dart';
import 'package:nham_mobile/data/billing/entitlements_provider.dart';

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
}

ProviderContainer _makeContainer(_LifecycleApi api) {
  final container = ProviderContainer(
    overrides: [
      apiClientProvider.overrideWithValue(api),
      entitlementsUserIdProvider.overrideWithValue(
        '11111111-1111-1111-1111-111111111111',
      ),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

class _LifecycleApi extends ApiClient {
  _LifecycleApi({required this.reconciliationRequired});

  final bool reconciliationRequired;
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
    return Future<T>.value(_entitlement(premium: true) as T);
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
