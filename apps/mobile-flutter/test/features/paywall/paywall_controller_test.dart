// Paywall controller lifecycle and account-isolation regressions.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nham_mobile/data/api_client.dart';
import 'package:nham_mobile/data/billing/purchases_service.dart';
import 'package:nham_mobile/data/session_provider.dart';
import 'package:nham_mobile/features/paywall/paywall_controller.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

const _userId = '11111111-1111-1111-1111-111111111111';
const _userIdB = '22222222-2222-2222-2222-222222222222';

final _testSessionProvider = StateProvider<Session?>(
  (ref) => _session(userId: _userId, accessToken: 'token-a'),
);

class _PendingEntitlementsApi extends ApiClient {
  final posts = <Completer<Map<String, dynamic>>>[];

  @override
  Future<T> get<T>(String path) async => _premiumEntitlement() as T;

  @override
  Future<T> post<T>(String path, [Object? body]) {
    final response = Completer<Map<String, dynamic>>();
    posts.add(response);
    return response.future.then((value) => value as T);
  }
}

Map<String, dynamic> _premiumEntitlement() => {
  'tier': 'premium',
  'purchasesEnabled': true,
  'isLifetime': false,
  'expiresAt': '2026-08-01T00:00:00.000Z',
  'willRenew': true,
  'source': 'app_store',
  'hasActiveSubscription': true,
  'trial': {'active': false, 'endsAt': null, 'daysRemaining': 0},
  'features': {
    'ai_analysis': {'allowed': true, 'reason': 'entitled'},
  },
};

Session _session({required String userId, required String accessToken}) {
  return Session(
    accessToken: accessToken,
    tokenType: 'bearer',
    user: User(
      id: userId,
      appMetadata: const {},
      userMetadata: const {},
      aud: 'authenticated',
      createdAt: '2026-07-28T00:00:00.000Z',
    ),
  );
}

void main() {
  test('token refresh does not reset a ready paywall state machine', () async {
    final container = ProviderContainer(
      overrides: [
        currentSessionProvider.overrideWith(
          (ref) => ref.watch(_testSessionProvider),
        ),
        purchasesServiceProvider.overrideWithValue(
          PurchasesService(apiKey: ''),
        ),
      ],
    );
    addTearDown(container.dispose);

    final phases = <PaywallPhase>[];
    final subscription = container.listen(
      paywallControllerProvider,
      (_, next) => phases.add(next.phase),
      fireImmediately: true,
    );
    addTearDown(subscription.close);
    await container.pump();
    await container.pump();
    expect(
      container.read(paywallControllerProvider).phase,
      PaywallPhase.unavailable,
    );

    phases.clear();
    container.read(_testSessionProvider.notifier).state = _session(
      userId: _userId,
      accessToken: 'token-b',
    );
    await container.pump();
    await container.pump();

    expect(phases, isEmpty);
    expect(
      container.read(paywallControllerProvider).phase,
      PaywallPhase.unavailable,
    );
  });

  test('account switch rebuilds a live paywall for the new owner', () async {
    final container = ProviderContainer(
      overrides: [
        currentSessionProvider.overrideWith(
          (ref) => ref.watch(_testSessionProvider),
        ),
        purchasesServiceProvider.overrideWithValue(
          PurchasesService(apiKey: ''),
        ),
      ],
    );
    addTearDown(container.dispose);

    final phases = <PaywallPhase>[];
    final subscription = container.listen(
      paywallControllerProvider,
      (_, next) => phases.add(next.phase),
      fireImmediately: true,
    );
    addTearDown(subscription.close);
    await container.pump();
    await container.pump();
    expect(
      container.read(paywallControllerProvider).phase,
      PaywallPhase.unavailable,
    );

    phases.clear();
    container.read(_testSessionProvider.notifier).state = _session(
      userId: _userIdB,
      accessToken: 'token-b',
    );
    await container.pump();
    await container.pump();

    expect(
      container.read(paywallControllerProvider).phase,
      PaywallPhase.unavailable,
    );
    expect(phases, [PaywallPhase.loading, PaywallPhase.unavailable]);
  });

  test(
    'old account completion cannot block or unlock the new account operation',
    () async {
      final api = _PendingEntitlementsApi();
      final container = ProviderContainer(
        overrides: [
          currentSessionProvider.overrideWith(
            (ref) => ref.watch(_testSessionProvider),
          ),
          apiClientProvider.overrideWithValue(api),
          purchasesServiceProvider.overrideWithValue(
            PurchasesService(apiKey: ''),
          ),
        ],
      );
      addTearDown(container.dispose);

      final subscription = container.listen(
        paywallControllerProvider,
        (_, _) {},
        fireImmediately: true,
      );
      addTearDown(subscription.close);
      await container.pump();
      await container.pump();

      final oldAccountOperation =
          container.read(paywallControllerProvider.notifier).retryActivation();
      await container.pump();
      expect(api.posts, hasLength(1));

      container.read(_testSessionProvider.notifier).state = _session(
        userId: _userIdB,
        accessToken: 'token-b',
      );
      await container.pump();
      await container.pump();

      final newAccountOperation =
          container.read(paywallControllerProvider.notifier).retryActivation();
      await container.pump();
      expect(api.posts, hasLength(2));

      api.posts.first.complete(_premiumEntitlement());
      expect(await oldAccountOperation, PaywallActionResult.error);

      expect(
        await container
            .read(paywallControllerProvider.notifier)
            .retryActivation(),
        PaywallActionResult.error,
      );
      expect(api.posts, hasLength(2));

      api.posts.last.complete(_premiumEntitlement());
      expect(await newAccountOperation, PaywallActionResult.unlocked);
    },
  );

  test('provider-confirmed restore defers to server reconciliation', () {
    expect(immediateResultForRestore(RestoreOutcome.restored), isNull);
  });

  test('server lag after confirmed store result remains pending', () {
    expect(resultAfterEntitlementPoll(false), PaywallActionResult.pending);
  });

  test('receipt ownership conflict has a dedicated paywall result', () {
    expect(
      immediateResultForRestore(RestoreOutcome.accountConflict),
      PaywallActionResult.accountConflict,
    );
  });
}
