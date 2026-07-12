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

import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show PlatformException;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

import '../env.dart';

/// Outcome of a [PurchasesService.purchasePackage] call. `userCancelled` is a
/// silent, expected outcome (no error UI); `error` carries a message the caller
/// surfaces via the app's error convention.
enum PurchaseOutcome { success, userCancelled, error }

/// Result of a purchase attempt: the [outcome] plus an optional [message] for
/// the `error` case. (Named to avoid colliding with the SDK's `PurchaseResult`.)
class PurchaseAttempt {
  const PurchaseAttempt(this.outcome, {this.message});

  final PurchaseOutcome outcome;
  final String? message;

  bool get isSuccess => outcome == PurchaseOutcome.success;
  bool get isCancelled => outcome == PurchaseOutcome.userCancelled;
}

/// Thin, env-gated wrapper around the RevenueCat SDK.
class PurchasesService {
  PurchasesService({@visibleForTesting bool? overrideAvailable})
    : _configured = overrideAvailable ?? false;

  bool _configured;

  /// The platform RC API key from the dart-defines, or empty when unset/unknown
  /// platform. Empty ⇒ purchases unavailable.
  static String get _platformApiKey {
    if (Platform.isIOS || Platform.isMacOS) return Env.revenueCatAppleApiKey;
    if (Platform.isAndroid) return Env.revenueCatGoogleApiKey;
    return '';
  }

  /// True once [configure] has run against a non-empty platform key. The paywall
  /// gates its purchase surface on this — false shows the unavailable state.
  bool get purchasesAvailable => _configured;

  /// Configure the SDK at app start. Safe to call once; a no-op when the
  /// platform RC key is empty (so a dev build without RC config still boots).
  ///
  /// [initialAppUserID] identifies the RC customer with the Supabase uid when a
  /// session already exists at launch, so entitlements resolve without waiting
  /// for a later [logIn].
  Future<void> configure({String? initialAppUserID}) async {
    if (_configured) return;
    final key = _platformApiKey;
    if (key.isEmpty) return; // graceful: purchases stay unavailable

    if (kDebugMode) {
      await Purchases.setLogLevel(LogLevel.debug);
    }
    await Purchases.configure(
      PurchasesConfiguration(key)..appUserID = initialAppUserID,
    );
    _configured = true;
  }

  /// Alias the RC customer to the signed-in Supabase user. No-op when purchases
  /// are unavailable. Called from the session lifecycle on sign-in.
  Future<void> logIn(String supabaseUid) async {
    if (!_configured) return;
    try {
      await Purchases.logIn(supabaseUid);
    } on PlatformException catch (e) {
      // A transient log-in failure must never crash the app or block auth.
      if (kDebugMode) debugPrint('[purchases:logIn] $e');
    }
  }

  /// Detach the RC customer on sign-out (reverts to an anonymous RC id). No-op
  /// when purchases are unavailable.
  Future<void> logOut() async {
    if (!_configured) return;
    try {
      await Purchases.logOut();
    } on PlatformException catch (e) {
      // logOut throws if already anonymous — harmless, swallow.
      if (kDebugMode) debugPrint('[purchases:logOut] $e');
    }
  }

  /// The current offering's available packages (monthly / annual / lifetime),
  /// with live store prices. Returns an empty list when purchases are
  /// unavailable or no current offering is configured.
  Future<List<Package>> getPackages() async {
    if (!_configured) return const [];
    final offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages ?? const [];
  }

  /// Purchase a package. Returns a [PurchaseAttempt]; a user cancellation is a
  /// silent, expected outcome (never an error).
  Future<PurchaseAttempt> purchasePackage(Package package) async {
    if (!_configured) {
      return const PurchaseAttempt(PurchaseOutcome.error);
    }
    try {
      await Purchases.purchase(PurchaseParams.package(package));
      return const PurchaseAttempt(PurchaseOutcome.success);
    } on PlatformException catch (e) {
      final code = PurchasesErrorHelper.getErrorCode(e);
      if (code == PurchasesErrorCode.purchaseCancelledError) {
        return const PurchaseAttempt(PurchaseOutcome.userCancelled);
      }
      return PurchaseAttempt(PurchaseOutcome.error, message: e.message);
    }
  }

  /// Restore prior purchases. Returns `true` on a successful restore call (the
  /// caller then polls the server for the entitlement flip), `false` on error.
  Future<bool> restorePurchases() async {
    if (!_configured) return false;
    try {
      await Purchases.restorePurchases();
      return true;
    } on PlatformException catch (e) {
      if (kDebugMode) debugPrint('[purchases:restore] $e');
      return false;
    }
  }
}

/// Singleton [PurchasesService]. The session lifecycle (see [app.dart]) drives
/// configure / logIn / logOut; the paywall reads offerings and runs purchases.
final purchasesServiceProvider = Provider<PurchasesService>((ref) {
  return PurchasesService();
});
