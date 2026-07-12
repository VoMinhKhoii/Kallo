/// Paywall UI state machine — loads RC offerings, runs the purchase/restore
/// flow, and (on success) polls the SERVER entitlement endpoint until the tier
/// flips to premium. The client never self-grants.
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

import '../../data/billing/entitlements_provider.dart';
import '../../data/billing/purchases_service.dart';

/// Phase of the paywall interaction, used to drive button loading / overlays.
enum PaywallPhase {
  /// Fetching offerings.
  loading,

  /// Offerings ready — packages shown.
  ready,

  /// Offerings failed to load.
  loadError,

  /// Purchases are not available (no RC key configured) — graceful state.
  unavailable,

  /// A purchase is in flight (store sheet or verification).
  purchasing,

  /// Purchase/restore succeeded; polling the server for the entitlement flip.
  verifying,
}

/// Immutable paywall state.
class PaywallState {
  const PaywallState({
    this.phase = PaywallPhase.loading,
    this.packages = const [],
    this.busyPackageId,
  });

  final PaywallPhase phase;
  final List<Package> packages;

  /// The package whose card should show a spinner (the one being purchased).
  final String? busyPackageId;

  PaywallState copyWith({
    PaywallPhase? phase,
    List<Package>? packages,
    String? busyPackageId,
    bool clearBusy = false,
  }) => PaywallState(
    phase: phase ?? this.phase,
    packages: packages ?? this.packages,
    busyPackageId: clearBusy ? null : (busyPackageId ?? this.busyPackageId),
  );
}

/// Result surfaced to the screen after a purchase/restore, so it can toast.
enum PaywallActionResult {
  /// Premium confirmed by the server — dismiss the paywall.
  unlocked,

  /// Store purchase/restore succeeded but the server hasn't flipped yet.
  pending,

  /// User cancelled the store sheet — silent, no UI.
  cancelled,

  /// Nothing to restore.
  nothingToRestore,

  /// A real error occurred.
  error,
}

class PaywallController extends AutoDisposeNotifier<PaywallState> {
  // AutoDispose: the paywall can be popped mid-await (offerings fetch, purchase,
  // poll). Writing `state` after disposal throws, so gate every post-await write
  // on this flag.
  bool _disposed = false;

  @override
  PaywallState build() {
    ref.onDispose(() => _disposed = true);
    // Kick off the offerings load once when the paywall mounts.
    Future.microtask(loadOfferings);
    return const PaywallState();
  }

  PurchasesService get _purchases => ref.read(purchasesServiceProvider);

  /// Write [state] only if the notifier is still alive (dispose-safe).
  void _set(PaywallState next) {
    if (_disposed) return;
    state = next;
  }

  Future<void> loadOfferings() async {
    if (_disposed) return;
    if (!_purchases.purchasesAvailable) {
      _set(state.copyWith(phase: PaywallPhase.unavailable));
      return;
    }
    _set(state.copyWith(phase: PaywallPhase.loading));
    try {
      final packages = await _purchases.getPackages();
      _set(state.copyWith(phase: PaywallPhase.ready, packages: packages));
    } catch (_) {
      _set(state.copyWith(phase: PaywallPhase.loadError));
    }
  }

  /// Purchase a package, then poll the server for the entitlement flip.
  Future<PaywallActionResult> purchase(Package package) async {
    _set(
      state.copyWith(
        phase: PaywallPhase.purchasing,
        busyPackageId: package.identifier,
      ),
    );
    final result = await _purchases.purchasePackage(package);
    if (result.isCancelled) {
      _set(state.copyWith(phase: PaywallPhase.ready, clearBusy: true));
      return PaywallActionResult.cancelled;
    }
    if (!result.isSuccess) {
      _set(state.copyWith(phase: PaywallPhase.ready, clearBusy: true));
      return PaywallActionResult.error;
    }
    return _pollAfterStoreSuccess();
  }

  /// Restore prior purchases, then poll the server for the entitlement flip.
  Future<PaywallActionResult> restore() async {
    _set(state.copyWith(phase: PaywallPhase.purchasing));
    final ok = await _purchases.restorePurchases();
    if (!ok) {
      _set(state.copyWith(phase: PaywallPhase.ready, clearBusy: true));
      return PaywallActionResult.error;
    }
    return _pollAfterStoreSuccess(restoring: true);
  }

  /// Shared tail for a successful store call: flip to `verifying`, then poll the
  /// server until premium or timeout.
  Future<PaywallActionResult> _pollAfterStoreSuccess({
    bool restoring = false,
  }) async {
    _set(state.copyWith(phase: PaywallPhase.verifying, clearBusy: true));
    final premium =
        await ref.read(entitlementsProvider.notifier).pollUntilPremium();
    // Leave the state on `verifying`→`ready` so the screen can dismiss / toast.
    _set(state.copyWith(phase: PaywallPhase.ready));
    if (premium) return PaywallActionResult.unlocked;
    // Restore that never flips = likely nothing to restore for this account.
    return restoring
        ? PaywallActionResult.nothingToRestore
        : PaywallActionResult.pending;
  }
}

final paywallControllerProvider =
    AutoDisposeNotifierProvider<PaywallController, PaywallState>(
      PaywallController.new,
    );
