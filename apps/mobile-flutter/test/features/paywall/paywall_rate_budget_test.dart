import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/data/api_client.dart';
import 'package:kallo_mobile/data/billing/purchases_service.dart';
import 'package:kallo_mobile/data/session_provider.dart';
import 'package:kallo_mobile/features/paywall/paywall_controller.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'paywall_test_support.dart';

const _userId = '11111111-1111-1111-1111-111111111111';

final _testSessionProvider = StateProvider<Session?>(
  (ref) => Session(
    accessToken: 'token-a',
    tokenType: 'bearer',
    user: const User(
      id: _userId,
      appMetadata: {},
      userMetadata: {},
      aud: 'authenticated',
      createdAt: '2026-07-28T00:00:00.000Z',
    ),
  ),
);

void main() {
  test(
    'cancel then retry success stays within reconciliation rate budget',
    () async {
      final api = PaywallEntitlementsApi();
      final purchases = PaywallPurchasesService(
        outcomes: const [
          PurchaseOutcome.userCancelled,
          PurchaseOutcome.success,
        ],
      );
      final container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(api),
          currentSessionProvider.overrideWith(
            (ref) => ref.watch(_testSessionProvider),
          ),
          purchasesServiceProvider.overrideWithValue(purchases),
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

      final controller = container.read(paywallControllerProvider.notifier);
      expect(
        await controller.purchase(monthlyPackage),
        PaywallActionResult.cancelled,
      );
      expect(api.postCalls, 1);

      expect(
        await controller.purchase(monthlyPackage),
        PaywallActionResult.unlocked,
      );
      expect(purchases.purchaseCalls, 2);
      expect(api.postCalls, 2);
      expect(api.getCalls, 2);
    },
  );

  test('cached reconcile still rechecks the commerce kill switch', () async {
    final api = PaywallEntitlementsApi();
    final purchases = PaywallPurchasesService(
      outcomes: const [PurchaseOutcome.userCancelled, PurchaseOutcome.success],
    );
    final container = ProviderContainer(
      overrides: [
        apiClientProvider.overrideWithValue(api),
        currentSessionProvider.overrideWith(
          (ref) => ref.watch(_testSessionProvider),
        ),
        purchasesServiceProvider.overrideWithValue(purchases),
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

    final controller = container.read(paywallControllerProvider.notifier);
    expect(
      await controller.purchase(monthlyPackage),
      PaywallActionResult.cancelled,
    );
    expect(api.postCalls, 1);

    api.purchasesEnabled = false;
    expect(
      await controller.purchase(monthlyPackage),
      PaywallActionResult.error,
    );
    expect(purchases.purchaseCalls, 1);
    expect(api.postCalls, 1);
    expect(api.getCalls, 2);
    expect(
      container.read(paywallControllerProvider).phase,
      PaywallPhase.unavailable,
    );
  });
}
