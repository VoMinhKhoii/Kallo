/// RevenueCat SDK wrapper — the ONLY place the app talks to `purchases_flutter`.
///
/// Scope: purchase / restore UX and offering fetch. It does **not** decide
/// entitlement gating — the server's `/api/v1/account/entitlements` endpoint is
/// authoritative (see [entitlements_provider.dart]). This wrapper never
/// self-grants; after a purchase/restore the caller polls the server (which
/// learns via the RC webhook) until the tier flips.
///
/// Configuration is env-gated exactly like [Analytics]: the platform RC API key
/// arrives via `--dart-define` (`REVENUECAT_APPLE_API_KEY` /
/// `REVENUECAT_GOOGLE_API_KEY`). When the key for the current platform is empty
/// (unset dev build), [configure] is a no-op, [purchasesAvailable] stays
/// `false`, and the paywall renders a graceful "unavailable" state instead of
/// crashing.
library;

import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show PlatformException;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

import '../env/env.dart';

/// Outcome of a [PurchasesService.purchasePackage] call. `userCancelled` is a
/// silent, expected outcome (no error UI); `error` carries a message the caller
/// surfaces via the app's error convention.
enum PurchaseOutcome {
  success,
  alreadyOwned,
  accountConflict,
  userCancelled,
  paymentPending,
  error,
}

/// Result of a purchase attempt: the [outcome] plus an optional [message] for
/// the `error` case. (Named to avoid colliding with the SDK's `PurchaseResult`.)
class PurchaseAttempt {
  const PurchaseAttempt(this.outcome, {this.message});

  final PurchaseOutcome outcome;
  final String? message;

  bool get isSuccess => outcome == PurchaseOutcome.success;
  bool get needsReconcile =>
      outcome == PurchaseOutcome.success ||
      outcome == PurchaseOutcome.alreadyOwned;
  bool get isCancelled => outcome == PurchaseOutcome.userCancelled;
}

/// Outcome of a restore request. A successful SDK call with an active store
/// entitlement is only a signal to reconcile with the server; it never grants
/// access locally.
enum RestoreOutcome { restored, nothingToRestore, accountConflict, error }

class RestoreAttempt {
  const RestoreAttempt(this.outcome, {this.message});

  final RestoreOutcome outcome;
  final String? message;

  bool get needsReconcile => outcome == RestoreOutcome.restored;
}

@visibleForTesting
PurchaseAttempt purchaseAttemptFromPlatformException(PlatformException error) {
  final code = PurchasesErrorHelper.getErrorCode(error);
  return switch (code) {
    PurchasesErrorCode.purchaseCancelledError => const PurchaseAttempt(
      PurchaseOutcome.userCancelled,
    ),
    PurchasesErrorCode.paymentPendingError => const PurchaseAttempt(
      PurchaseOutcome.paymentPending,
    ),
    // StoreKit and Google Play can report an item as already owned when a
    // prior transaction exists but the local/server snapshot is stale. Treat
    // that as a signal to reconcile, never as a reason to self-grant.
    PurchasesErrorCode.productAlreadyPurchasedError => const PurchaseAttempt(
      PurchaseOutcome.alreadyOwned,
    ),
    PurchasesErrorCode.receiptAlreadyInUseError ||
    PurchasesErrorCode.receiptInUseByOtherSubscriberError =>
      const PurchaseAttempt(PurchaseOutcome.accountConflict),
    _ => PurchaseAttempt(PurchaseOutcome.error, message: error.message),
  };
}

@visibleForTesting
Future<PurchaseAttempt> runPurchaseAttempt(
  Future<void> Function() purchase,
) async {
  try {
    await purchase();
    return const PurchaseAttempt(PurchaseOutcome.success);
  } on PlatformException catch (error) {
    return purchaseAttemptFromPlatformException(error);
  } catch (error) {
    if (kDebugMode) debugPrint('[purchases:purchase] $error');
    return PurchaseAttempt(PurchaseOutcome.error, message: '$error');
  }
}

@visibleForTesting
RestoreAttempt restoreAttemptFromPlatformException(PlatformException error) {
  final code = PurchasesErrorHelper.getErrorCode(error);
  return switch (code) {
    PurchasesErrorCode.receiptAlreadyInUseError ||
    PurchasesErrorCode.receiptInUseByOtherSubscriberError =>
      const RestoreAttempt(RestoreOutcome.accountConflict),
    _ => RestoreAttempt(RestoreOutcome.error, message: error.message),
  };
}

@visibleForTesting
RestoreAttempt restoreAttemptFromCustomerInfo(CustomerInfo customerInfo) {
  if (customerInfo.entitlements.active.isEmpty) {
    return const RestoreAttempt(RestoreOutcome.nothingToRestore);
  }
  return const RestoreAttempt(RestoreOutcome.restored);
}

const _allowedMobileProducts = <String, PackageType>{
  'kallo_premium_monthly': PackageType.monthly,
  'kallo_premium_monthly:monthly': PackageType.monthly,
  'kallo_premium_annual': PackageType.annual,
  'kallo_premium_annual:annual': PackageType.annual,
  'kallo_premium_lifetime': PackageType.lifetime,
};

@visibleForTesting
bool isAllowedMobilePackage(String productId, PackageType packageType) {
  return _allowedMobileProducts[productId] == packageType;
}

@visibleForTesting
bool isAllowedRevenueCatMobileApiKey(
  String apiKey, {
  required bool applePlatform,
  required bool androidPlatform,
  required bool debugMode,
}) {
  if (debugMode && apiKey.startsWith('test_')) return true;
  if (applePlatform) return apiKey.startsWith('appl_');
  if (androidPlatform) return apiKey.startsWith('goog_');
  return false;
}

abstract interface class PurchasesGateway {
  Future<void> setLogLevel(LogLevel level);
  Future<void> configure(PurchasesConfiguration configuration);
  Future<LogInResult> logIn(String appUserId);
  Future<Offerings> getOfferings();
  Future<PurchaseResult> purchase(PurchaseParams params);
  Future<CustomerInfo> restorePurchases();
  Future<Map<String, IntroEligibility>> checkTrialOrIntroductoryPriceEligibility(
    List<String> productIdentifiers,
  );
}

class _NativePurchasesGateway implements PurchasesGateway {
  @override
  Future<void> setLogLevel(LogLevel level) => Purchases.setLogLevel(level);

  @override
  Future<void> configure(PurchasesConfiguration configuration) =>
      Purchases.configure(configuration);

  @override
  Future<LogInResult> logIn(String appUserId) => Purchases.logIn(appUserId);

  @override
  Future<Offerings> getOfferings() => Purchases.getOfferings();

  @override
  Future<PurchaseResult> purchase(PurchaseParams params) =>
      Purchases.purchase(params);

  @override
  Future<CustomerInfo> restorePurchases() => Purchases.restorePurchases();

  @override
  Future<Map<String, IntroEligibility>> checkTrialOrIntroductoryPriceEligibility(
    List<String> productIdentifiers,
  ) => Purchases.checkTrialOrIntroductoryPriceEligibility(productIdentifiers);
}

/// Thin, env-gated wrapper around the RevenueCat SDK.
class PurchasesService {
  PurchasesService({
    @visibleForTesting PurchasesGateway? gateway,
    @visibleForTesting String? apiKey,
  }) : _gateway = gateway ?? _NativePurchasesGateway(),
       _apiKey = apiKey ?? _platformApiKey;

  final PurchasesGateway _gateway;
  final String _apiKey;
  bool _configured = false;
  String? _readyUserId;
  Future<void> _operationQueue = Future<void>.value();

  /// The platform RC API key from the dart-defines, or empty when unset/unknown
  /// platform. Empty ⇒ purchases unavailable.
  static String get _platformApiKey {
    if (Platform.isIOS || Platform.isMacOS) return Env.revenueCatAppleApiKey;
    if (Platform.isAndroid) return Env.revenueCatGoogleApiKey;
    return '';
  }

  bool get _apiKeyAllowed => isAllowedRevenueCatMobileApiKey(
    _apiKey,
    applePlatform: Platform.isIOS || Platform.isMacOS,
    androidPlatform: Platform.isAndroid,
    debugMode: kDebugMode,
  );

  /// True once [configure] has run against a non-empty platform key. The paywall
  /// gates its purchase surface on this — false shows the unavailable state.
  bool get purchasesAvailable => _apiKeyAllowed;
  bool isReadyFor(String userId) => _configured && _readyUserId == userId;

  /// Configure the SDK at app start. Safe to call once; a no-op when the
  /// platform RC key is empty (so a dev build without RC config still boots).
  ///
  /// [initialAppUserID] identifies the RC customer with the Supabase uid when a
  /// session already exists at launch, so entitlements resolve without waiting
  /// for a later [logIn].
  Future<void> identify(String supabaseUid) {
    return _runSerialized(() => _identifyUnlocked(supabaseUid));
  }

  Future<void> _identifyUnlocked(String supabaseUid) async {
    if (_readyUserId == supabaseUid) return;
    final key = _apiKey;
    if (!_apiKeyAllowed) {
      throw StateError('RevenueCat public platform key is not configured.');
    }
    if (!_configured) {
      if (kDebugMode) await _gateway.setLogLevel(LogLevel.debug);
      await _gateway.configure(
        PurchasesConfiguration(key)..appUserID = supabaseUid,
      );
      _configured = true;
    } else {
      await _gateway.logIn(supabaseUid);
    }
    _readyUserId = supabaseUid;
  }

  Future<T> _runSerialized<T>(Future<T> Function() operation) async {
    final previous = _operationQueue;
    final release = Completer<void>();
    _operationQueue = previous.catchError((_) {}).then((_) => release.future);
    await previous.catchError((_) {});
    try {
      return await operation();
    } finally {
      release.complete();
    }
  }

  /// The current offering's available packages (monthly / annual / lifetime),
  /// with live store prices. Returns an empty list when purchases are
  /// unavailable or no current offering is configured.
  Future<List<Package>> getPackages(String userId) {
    return _runSerialized(() async {
      await _identifyUnlocked(userId);
      if (!isReadyFor(userId)) return const <Package>[];
      final offerings = await _gateway.getOfferings();
      final packages =
          offerings.current?.availablePackages ?? const <Package>[];
      return packages
          .where((package) {
            final allowed = isAllowedMobilePackage(
              package.storeProduct.identifier,
              package.packageType,
            );
            if (!allowed && kDebugMode) {
              debugPrint(
                '[purchases:offerings] Ignoring unexpected product/package: '
                '${package.storeProduct.identifier}/${package.packageType.name}',
              );
            }
            return allowed;
          })
          .toList(growable: false);
    });
  }

  /// The product ids this customer can still START a free trial (or other
  /// introductory offer) on — the paywall's trial copy hangs off this, not off
  /// the declared `introductoryPrice` every customer sees. iOS only: anything
  /// RevenueCat cannot decide reports `unknown`, and RC's guidance is to show
  /// non-introductory pricing then, so unknown counts as NOT eligible. Never
  /// throws; the paywall has to render either way.
  Future<Set<String>> trialEligibleProductIds(List<String> productIds) async {
    if (productIds.isEmpty || !_apiKeyAllowed) return const {};
    try {
      final eligibility = await _gateway
          .checkTrialOrIntroductoryPriceEligibility(productIds);
      return {
        for (final entry in eligibility.entries)
          if (entry.value.status ==
              IntroEligibilityStatus.introEligibilityStatusEligible)
            entry.key,
      };
    } catch (error) {
      if (kDebugMode) debugPrint('[purchases:introEligibility] $error');
      return const {};
    }
  }

  /// Purchase a package. Returns a [PurchaseAttempt]; a user cancellation is a
  /// silent, expected outcome (never an error).
  Future<PurchaseAttempt> purchasePackage(String userId, Package package) {
    return _runSerialized(() async {
      try {
        await _identifyUnlocked(userId);
      } catch (error) {
        return PurchaseAttempt(PurchaseOutcome.error, message: '$error');
      }
      if (!isReadyFor(userId)) {
        return const PurchaseAttempt(PurchaseOutcome.error);
      }
      return runPurchaseAttempt(() async {
        await _gateway.purchase(PurchaseParams.package(package));
      });
    });
  }

  /// Restore prior purchases. A store-confirmed result still requires server
  /// reconciliation before premium can be shown as active.
  Future<RestoreAttempt> restorePurchases(String userId) {
    return _runSerialized(() async {
      try {
        await _identifyUnlocked(userId);
        if (!isReadyFor(userId)) {
          return const RestoreAttempt(RestoreOutcome.error);
        }
      } catch (error) {
        if (kDebugMode) debugPrint('[purchases:restore:identify] $error');
        return RestoreAttempt(RestoreOutcome.error, message: '$error');
      }
      try {
        final customerInfo = await _gateway.restorePurchases();
        return restoreAttemptFromCustomerInfo(customerInfo);
      } on PlatformException catch (e) {
        if (kDebugMode) debugPrint('[purchases:restore] $e');
        return restoreAttemptFromPlatformException(e);
      } catch (error) {
        if (kDebugMode) debugPrint('[purchases:restore] $error');
        return RestoreAttempt(RestoreOutcome.error, message: '$error');
      }
    });
  }
}

/// Singleton [PurchasesService]. The session lifecycle (see [app.dart]) drives
/// configure / logIn / logOut; the paywall reads offerings and runs purchases.
final purchasesServiceProvider = Provider<PurchasesService>((ref) {
  return PurchasesService();
});
