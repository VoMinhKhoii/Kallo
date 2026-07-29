import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nham_mobile/data/api_client.dart';
import 'package:nham_mobile/data/billing/entitlement_state.dart';
import 'package:nham_mobile/data/billing/entitlements_provider.dart';

const _userId = '11111111-1111-1111-1111-111111111111';

class _FailingRefreshApi extends ApiClient {
  var calls = 0;

  @override
  Future<T> get<T>(String path) async {
    calls += 1;
    if (calls > 1) throw StateError('transient failure');

    return {
          'tier': 'premium',
          'purchasesEnabled': true,
          'isLifetime': true,
          'willRenew': false,
          'source': 'test_store',
          'hasActiveSubscription': false,
          'trial': {'active': false, 'endsAt': null, 'daysRemaining': 0},
          'features': {
            'ai_analysis': {'allowed': true, 'reason': 'entitled'},
          },
        }
        as T;
  }
}

class _OutOfOrderApi extends ApiClient {
  final staleGet = Completer<Map<String, dynamic>>();
  var getCalls = 0;

  @override
  Future<T> get<T>(String path) async {
    getCalls += 1;
    if (getCalls == 1) return _freeEntitlement() as T;
    return staleGet.future.then((value) => value as T);
  }

  @override
  Future<T> post<T>(String path, [Object? body]) async {
    return _premiumEntitlement() as T;
  }
}

class _BuildRaceApi extends ApiClient {
  _BuildRaceApi({required this.blockInitialGet});

  final bool blockInitialGet;
  final initialGet = Completer<Map<String, dynamic>>();
  final reconcileResponse = Completer<Map<String, dynamic>>();
  var getCalls = 0;

  @override
  Future<T> get<T>(String path) async {
    getCalls += 1;
    if (getCalls == 1 && blockInitialGet) {
      return initialGet.future.then((value) => value as T);
    }
    return _freeEntitlement() as T;
  }

  @override
  Future<T> post<T>(String path, [Object? body]) {
    return reconcileResponse.future.then((value) => value as T);
  }
}

class _HungThenSuccessfulPostApi extends ApiClient {
  final hungPost = Completer<Map<String, dynamic>>();
  var postCalls = 0;

  @override
  Future<T> get<T>(String path) async => _freeEntitlement() as T;

  @override
  Future<T> post<T>(String path, [Object? body]) {
    postCalls += 1;
    if (postCalls == 1) {
      return hungPost.future.then((value) => value as T);
    }
    return Future<T>.value(_premiumEntitlement() as T);
  }
}

Map<String, dynamic> _freeEntitlement() => {
  'tier': 'free',
  'purchasesEnabled': true,
  'isLifetime': false,
  'willRenew': false,
  'hasActiveSubscription': false,
  'trial': {'active': false, 'endsAt': null, 'daysRemaining': 0},
  'features': {
    'ai_analysis': {'allowed': false, 'reason': 'not_entitled'},
  },
};

Map<String, dynamic> _premiumEntitlement() => {
  ..._freeEntitlement(),
  'tier': 'premium',
  'isLifetime': true,
  'source': 'test_store',
  'features': {
    'ai_analysis': {'allowed': true, 'reason': 'entitled'},
  },
};

void main() {
  test('refresh preserves a valid snapshot on transient failure', () async {
    final api = _FailingRefreshApi();
    final container = ProviderContainer(
      overrides: [
        apiClientProvider.overrideWithValue(api),
        entitlementsUserIdProvider.overrideWithValue(_userId),
      ],
    );
    addTearDown(container.dispose);

    final subscription = container.listen(
      entitlementsProvider(_userId),
      (_, _) {},
      fireImmediately: true,
    );
    addTearDown(subscription.close);

    final initial = await container.read(entitlementsProvider(_userId).future);
    expect(initial.isPremium, isTrue);

    final refresh =
        container.read(entitlementsProvider(_userId).notifier).refresh();
    final loading = container.read(entitlementsProvider(_userId));
    expect(loading.isLoading, isTrue);
    expect(loading.valueOrNull?.isPremium, isTrue);

    await refresh;

    final preserved = container.read(entitlementsProvider(_userId));
    expect(preserved, isA<AsyncData<EntitlementState>>());
    expect(preserved.valueOrNull?.isPremium, isTrue);
    expect(api.calls, 2);
  });

  test(
    'older same-user completion cannot replace newer premium state',
    () async {
      final api = _OutOfOrderApi();
      final container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(api),
          entitlementsUserIdProvider.overrideWithValue(_userId),
        ],
      );
      addTearDown(container.dispose);

      final subscription = container.listen(
        entitlementsProvider(_userId),
        (_, _) {},
        fireImmediately: true,
      );
      addTearDown(subscription.close);
      await container.read(entitlementsProvider(_userId).future);

      final staleRefresh =
          container
              .read(entitlementsProvider(_userId).notifier)
              .refreshSnapshot();
      await container.pump();

      final reconciled =
          await container
              .read(entitlementsProvider(_userId).notifier)
              .reconcile();
      expect(reconciled?.isPremium, isTrue);

      api.staleGet.complete(_freeEntitlement());
      expect(await staleRefresh, isNull);
      expect(
        container.read(entitlementsProvider(_userId)).valueOrNull?.isPremium,
        isTrue,
      );
    },
  );

  test('older build failure cannot replace newer premium state', () async {
    final api = _BuildRaceApi(blockInitialGet: true);
    final container = ProviderContainer(
      overrides: [
        apiClientProvider.overrideWithValue(api),
        entitlementsUserIdProvider.overrideWithValue(_userId),
      ],
    );
    addTearDown(container.dispose);

    final subscription = container.listen(
      entitlementsProvider(_userId),
      (_, _) {},
      fireImmediately: true,
    );
    addTearDown(subscription.close);
    await container.pump();

    final reconcile =
        container.read(entitlementsProvider(_userId).notifier).reconcile();
    api.reconcileResponse.complete(_premiumEntitlement());
    expect((await reconcile)?.isPremium, isTrue);

    api.initialGet.completeError(StateError('stale build failure'));
    await container.pump();

    final state = container.read(entitlementsProvider(_userId));
    expect(state, isA<AsyncData<EntitlementState>>());
    expect(state.valueOrNull?.isPremium, isTrue);
  });

  test('resume rebuild cannot outrank in-flight reconciliation', () async {
    final api = _BuildRaceApi(blockInitialGet: false);
    final container = ProviderContainer(
      overrides: [
        apiClientProvider.overrideWithValue(api),
        entitlementsUserIdProvider.overrideWithValue(_userId),
      ],
    );
    addTearDown(container.dispose);

    final subscription = container.listen(
      entitlementsProvider(_userId),
      (_, _) {},
      fireImmediately: true,
    );
    addTearDown(subscription.close);
    await container.read(entitlementsProvider(_userId).future);

    final reconcile =
        container.read(entitlementsProvider(_userId).notifier).reconcile();
    await container.pump();
    container.invalidate(entitlementsProvider(_userId));
    await container.pump();

    api.reconcileResponse.complete(_premiumEntitlement());
    expect((await reconcile)?.isPremium, isTrue);
    await container.pump();

    expect(api.getCalls, 1);
    expect(
      container.read(entitlementsProvider(_userId)).valueOrNull?.isPremium,
      isTrue,
    );
  });

  test('timed-out reconciliation releases the controller for retry', () async {
    final api = _HungThenSuccessfulPostApi();
    final container = ProviderContainer(
      overrides: [
        apiClientProvider.overrideWithValue(api),
        entitlementsUserIdProvider.overrideWithValue(_userId),
        entitlementRequestTimeoutProvider.overrideWithValue(
          const Duration(milliseconds: 5),
        ),
      ],
    );
    addTearDown(container.dispose);

    final subscription = container.listen(
      entitlementsProvider(_userId),
      (_, _) {},
      fireImmediately: true,
    );
    addTearDown(subscription.close);
    await container.read(entitlementsProvider(_userId).future);

    final first =
        await container
            .read(entitlementsProvider(_userId).notifier)
            .reconcile();
    expect(first, isNull);

    final retried =
        await container
            .read(entitlementsProvider(_userId).notifier)
            .reconcile();
    expect(retried?.isPremium, isTrue);
    expect(api.postCalls, 2);
  });
}
