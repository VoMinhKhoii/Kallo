import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:purchases_flutter/purchases_flutter.dart';
import 'package:kallo_mobile/data/billing/purchases_service.dart';

class FakePurchasesGateway implements PurchasesGateway {
  int configureCalls = 0;
  int loginCalls = 0;
  int offeringsCalls = 0;
  int restoreCalls = 0;
  Completer<void>? configureCompleter;
  Completer<CustomerInfo>? restoreCompleter;
  Object? loginError;

  @override
  Future<void> configure(PurchasesConfiguration configuration) {
    configureCalls += 1;
    return configureCompleter?.future ?? Future<void>.value();
  }

  @override
  Future<Offerings> getOfferings() {
    offeringsCalls += 1;
    throw UnimplementedError();
  }

  @override
  Future<LogInResult> logIn(String appUserId) {
    loginCalls += 1;
    if (loginError != null) return Future<LogInResult>.error(loginError!);
    throw UnimplementedError();
  }

  @override
  Future<PurchaseResult> purchase(PurchaseParams params) =>
      throw UnimplementedError();

  @override
  Future<CustomerInfo> restorePurchases() {
    restoreCalls += 1;
    return restoreCompleter?.future ??
        Future<CustomerInfo>.error(UnimplementedError());
  }

  @override
  Future<void> setLogLevel(LogLevel level) async {}
}

void main() {
  const userA = '11111111-1111-1111-1111-111111111111';
  const userB = '22222222-2222-2222-2222-222222222222';

  test(
    'mobile package allowlist rejects wrong products and cadence labels',
    () {
      expect(
        isAllowedMobilePackage('kallo_premium_monthly', PackageType.monthly),
        isTrue,
      );
      expect(
        isAllowedMobilePackage(
          'kallo_premium_annual:annual',
          PackageType.annual,
        ),
        isTrue,
      );
      expect(
        isAllowedMobilePackage('kallo_premium_annual_web', PackageType.annual),
        isFalse,
      );
      expect(
        isAllowedMobilePackage('kallo_premium_lifetime', PackageType.monthly),
        isFalse,
      );
      expect(
        isAllowedMobilePackage(
          'kallo_premium_monthly:annual',
          PackageType.monthly,
        ),
        isFalse,
      );
      expect(
        isAllowedMobilePackage(
          'kallo_premium_annual:monthly',
          PackageType.annual,
        ),
        isFalse,
      );
      expect(
        isAllowedMobilePackage(
          'kallo_premium_lifetime:annual',
          PackageType.lifetime,
        ),
        isFalse,
      );
    },
  );

  test('already-owned store result triggers server reconciliation', () {
    final attempt = purchaseAttemptFromPlatformException(
      PlatformException(code: '6'),
    );
    expect(attempt.outcome, PurchaseOutcome.alreadyOwned);
    expect(attempt.needsReconcile, isTrue);
  });

  test('purchase reports both receipt ownership errors explicitly', () {
    for (final code in ['7', '13']) {
      final attempt = purchaseAttemptFromPlatformException(
        PlatformException(code: code),
      );
      expect(attempt.outcome, PurchaseOutcome.accountConflict);
      expect(attempt.needsReconcile, isFalse);
    }
  });

  test('mobile API keys enforce platform and release boundaries', () {
    expect(
      isAllowedRevenueCatMobileApiKey(
        'appl_public',
        applePlatform: true,
        androidPlatform: false,
        debugMode: false,
      ),
      isTrue,
    );
    expect(
      isAllowedRevenueCatMobileApiKey(
        'goog_public',
        applePlatform: false,
        androidPlatform: true,
        debugMode: false,
      ),
      isTrue,
    );
    for (final key in ['sk_secret', 'atk_secret', 'appl_wrong']) {
      expect(
        isAllowedRevenueCatMobileApiKey(
          key,
          applePlatform: false,
          androidPlatform: true,
          debugMode: false,
        ),
        isFalse,
      );
    }
    expect(
      isAllowedRevenueCatMobileApiKey(
        'test_sandbox',
        applePlatform: false,
        androidPlatform: true,
        debugMode: true,
      ),
      isTrue,
    );
    expect(
      isAllowedRevenueCatMobileApiKey(
        'test_sandbox',
        applePlatform: false,
        androidPlatform: true,
        debugMode: false,
      ),
      isFalse,
    );
  });

  test(
    'concurrent identity requests configure once with the custom UUID',
    () async {
      final gateway =
          FakePurchasesGateway()..configureCompleter = Completer<void>();
      final service = PurchasesService(
        gateway: gateway,
        apiKey: 'test_sandbox',
      );

      final first = service.identify(userA);
      final second = service.identify(userA);
      await Future<void>.delayed(Duration.zero);
      expect(gateway.configureCalls, 1);

      gateway.configureCompleter!.complete();
      await Future.wait([first, second]);
      expect(gateway.configureCalls, 1);
      expect(service.isReadyFor(userA), isTrue);
    },
  );

  test('failed account switch blocks the new user from offerings', () async {
    final gateway = FakePurchasesGateway();
    final service = PurchasesService(gateway: gateway, apiKey: 'test_sandbox');
    await service.identify(userA);
    gateway.loginError = StateError('identity switch failed');

    await expectLater(service.getPackages(userB), throwsStateError);
    expect(gateway.loginCalls, 1);
    expect(gateway.offeringsCalls, 0);
    expect(service.isReadyFor(userB), isFalse);
    expect(service.isReadyFor(userA), isTrue);
  });

  test('account switching waits until an in-flight restore settles', () async {
    final gateway =
        FakePurchasesGateway()..restoreCompleter = Completer<CustomerInfo>();
    final service = PurchasesService(gateway: gateway, apiKey: 'test_sandbox');
    await service.identify(userA);

    final restore = service.restorePurchases(userA);
    await Future<void>.delayed(Duration.zero);
    expect(gateway.restoreCalls, 1);

    gateway.loginError = StateError('identity switch failed');
    final accountSwitch = service.identify(userB);
    await Future<void>.delayed(Duration.zero);
    expect(gateway.loginCalls, 0);

    gateway.restoreCompleter!.completeError(PlatformException(code: '1'));
    expect((await restore).outcome, RestoreOutcome.error);
    await expectLater(accountSwitch, throwsStateError);
    expect(gateway.loginCalls, 1);
  });

  test(
    'unexpected purchase failures return a recoverable error result',
    () async {
      final attempt = await runPurchaseAttempt(
        () => Future<void>.error(StateError('channel unavailable')),
      );

      expect(attempt.outcome, PurchaseOutcome.error);
      expect(attempt.message, contains('channel unavailable'));
    },
  );

  test('restore reports both receipt ownership errors explicitly', () {
    for (final code in ['7', '13']) {
      final attempt = restoreAttemptFromPlatformException(
        PlatformException(code: code),
      );
      expect(attempt.outcome, RestoreOutcome.accountConflict);
      expect(attempt.needsReconcile, isFalse);
    }
  });
}
