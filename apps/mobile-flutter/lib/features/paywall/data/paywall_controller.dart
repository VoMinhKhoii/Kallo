/// Paywall UI state machine — loads RC offerings, runs the purchase/restore
/// flow, and (on success) polls the SERVER entitlement endpoint until the tier
/// flips to premium. The client never self-grants.
library;

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

import '../../../services/billing/activation_pending.dart';
import '../../../services/billing/entitlement_state.dart';
import '../../../services/billing/entitlements_provider.dart';
import '../../../services/billing/purchases_service.dart';
import '../../../services/auth/session_provider.dart';

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

  /// Store accepted/pending the payment but server access is not confirmed.
  activationPending,
}

/// Immutable paywall state.
class PaywallState {
  const PaywallState({
    this.phase = PaywallPhase.loading,
    this.packages = const [],
    this.trialEligibleProductIds = const {},
    this.busyPackageId,
  });

  final PaywallPhase phase;
  final List<Package> packages;

  /// The product ids the STORE says this customer can still start a trial on —
  /// what the sheet's trial copy is allowed to promise. Empty until the
  /// offerings load, and empty wherever eligibility is unknown (Android).
  final Set<String> trialEligibleProductIds;

  /// The package whose card should show a spinner (the one being purchased).
  final String? busyPackageId;

  PaywallState copyWith({
    PaywallPhase? phase,
    List<Package>? packages,
    Set<String>? trialEligibleProductIds,
    String? busyPackageId,
    bool clearBusy = false,
  }) => PaywallState(
    phase: phase ?? this.phase,
    packages: packages ?? this.packages,
    trialEligibleProductIds:
        trialEligibleProductIds ?? this.trialEligibleProductIds,
    busyPackageId: clearBusy ? null : (busyPackageId ?? this.busyPackageId),
  );
}

/// Result surfaced to the screen after a purchase/restore, so it can toast.
enum PaywallActionResult {
  /// Premium confirmed by the server — dismiss the paywall.
  unlocked,

  /// Store purchase/restore succeeded but the server hasn't flipped yet.
  pending,

  /// Store explicitly reports that payment has not completed yet.
  paymentPending,

  /// User cancelled the store sheet — silent, no UI.
  cancelled,

  /// Nothing to restore.
  nothingToRestore,

  /// The store receipt is attached to a different Kallo account.
  accountConflict,

  /// A real error occurred.
  error,
}

@visibleForTesting
PaywallActionResult? immediateResultForRestore(RestoreOutcome outcome) {
  return switch (outcome) {
    RestoreOutcome.restored => null,
    RestoreOutcome.nothingToRestore => PaywallActionResult.nothingToRestore,
    RestoreOutcome.accountConflict => PaywallActionResult.accountConflict,
    RestoreOutcome.error => PaywallActionResult.error,
  };
}

@visibleForTesting
PaywallActionResult resultAfterEntitlementPoll(bool premium) {
  return premium ? PaywallActionResult.unlocked : PaywallActionResult.pending;
}

class PaywallController extends AutoDisposeNotifier<PaywallState> {
  static const _preStoreReconcileReuseWindow = Duration(minutes: 1);

  // AutoDispose: the paywall can be popped mid-await (offerings fetch, purchase,
  // poll). Writing `state` after disposal throws, so gate every post-await write
  // on this flag.
  bool _disposed = false;
  int _operationGeneration = 0;
  int? _activeOperation;
  DateTime? _lastPreStoreReconciledAt;

  @override
  PaywallState build() {
    _disposed = false;
    _operationGeneration += 1;
    _activeOperation = null;
    _lastPreStoreReconciledAt = null;
    // A Supabase token refresh replaces the Session object even though the
    // authenticated user is unchanged. Watch only the selected user id so a
    // refresh cannot reset a ready paywall in the middle of a purchase.
    final userId = ref.watch(
      currentSessionProvider.select((session) => session?.user.id),
    );
    // The paywall consumes the entitlement snapshot across load, tap-time
    // verification, and post-store polling. Keep the auto-dispose family
    // member alive for that whole screen lifetime so a tap cannot recreate it
    // and issue a duplicate background fetch beside the explicit refresh.
    if (userId != null) {
      ref.listen(entitlementsProvider(userId), (_, _) {});
    }
    ref.onDispose(() => _disposed = true);
    // Kick off the offerings load once when the paywall mounts.
    Future.microtask(loadOfferings);
    return const PaywallState();
  }

  PurchasesService get _purchases => ref.read(purchasesServiceProvider);
  String? get _userId => ref.read(currentSessionProvider)?.user.id;

  /// Write [state] only if the notifier is still alive (dispose-safe).
  void _set(PaywallState next) {
    if (_disposed) return;
    state = next;
  }

  bool _isCurrentUser(String userId) => !_disposed && _userId == userId;

  Future<void> loadOfferings() async {
    if (_disposed) return;
    final userId = _userId;
    if (!_purchases.purchasesAvailable || userId == null) {
      _set(state.copyWith(phase: PaywallPhase.unavailable));
      return;
    }
    _set(state.copyWith(phase: PaywallPhase.loading));
    try {
      final entitlement = await ref.read(entitlementsProvider(userId).future);
      if (!_isCurrentUser(userId)) return;
      if (!entitlement.purchasesEnabled && !entitlement.isPremium) {
        _set(state.copyWith(phase: PaywallPhase.unavailable));
        return;
      }
      if (entitlement.isPremium) {
        _set(state.copyWith(phase: PaywallPhase.ready, packages: const []));
        return;
      }
      final packages = await _purchases.getPackages(userId);
      if (!_isCurrentUser(userId)) return;
      // Asked once, with the offerings: the answer is a property of the store
      // account, so it cannot change while this sheet is open.
      final eligible = await _purchases.trialEligibleProductIds([
        for (final package in packages) package.storeProduct.identifier,
      ]);
      if (!_isCurrentUser(userId)) return;
      _set(
        state.copyWith(
          phase: PaywallPhase.ready,
          packages: packages,
          trialEligibleProductIds: eligible,
        ),
      );
    } catch (_) {
      if (_isCurrentUser(userId)) {
        _set(state.copyWith(phase: PaywallPhase.loadError));
      }
    }
  }

  /// Purchase a package, then poll the server for the entitlement flip.
  Future<PaywallActionResult> purchase(Package package) async {
    final userId = _userId;
    if (userId == null) return PaywallActionResult.error;
    final operation = _beginOperation();
    if (operation == null) return PaywallActionResult.error;
    try {
      // Reconcile at the final pre-store boundary to recover a missed webhook.
      // A recent successful reconcile can be reused for one server rate-limit
      // window; the lightweight snapshot fetch still rechecks the emergency
      // commerce switch before every StoreKit call.
      final entitlement = await _preStoreEntitlement(userId);
      if (!_isCurrentUser(userId)) return PaywallActionResult.error;
      if (entitlement == null) {
        // A transient reconciliation failure is not evidence that commerce
        // was disabled. Block this attempt but keep packages retryable.
        _set(state.copyWith(phase: PaywallPhase.ready, clearBusy: true));
        return PaywallActionResult.error;
      }
      if (entitlement.isPremium) {
        _set(
          state.copyWith(
            phase: PaywallPhase.ready,
            packages: const [],
            clearBusy: true,
          ),
        );
        return PaywallActionResult.unlocked;
      }
      if (!entitlement.purchasesEnabled) {
        _set(state.copyWith(phase: PaywallPhase.unavailable));
        return PaywallActionResult.error;
      }
      _set(
        state.copyWith(
          phase: PaywallPhase.purchasing,
          busyPackageId: package.identifier,
        ),
      );
      // Record the attempt BEFORE handing control to the store. The likeliest
      // interruption is a purchase whose app is backgrounded or killed before
      // the future below completes — a marker written afterwards would be
      // missing in exactly the case it exists for. An abandoned checkout costs
      // one wasted reconcile; a lost one costs a customer their money.
      final pendingStore = ref.read(activationPendingStoreProvider);
      await pendingStore.mark(userId);
      final result = await _purchases.purchasePackage(userId, package);
      if (!_isCurrentUser(userId)) return PaywallActionResult.error;
      if (result.isCancelled) {
        // Explicitly dismissed, so no money moved and nothing needs healing.
        await pendingStore.clear(userId);
        _set(state.copyWith(phase: PaywallPhase.ready, clearBusy: true));
        return PaywallActionResult.cancelled;
      }
      if (!result.needsReconcile) {
        if (result.outcome == PurchaseOutcome.accountConflict) {
          _set(state.copyWith(phase: PaywallPhase.ready, clearBusy: true));
          return PaywallActionResult.accountConflict;
        }
        if (result.outcome == PurchaseOutcome.paymentPending) {
          _set(
            state.copyWith(
              phase: PaywallPhase.activationPending,
              clearBusy: true,
            ),
          );
          return PaywallActionResult.paymentPending;
        }
        _set(state.copyWith(phase: PaywallPhase.ready, clearBusy: true));
        return PaywallActionResult.error;
      }
      return await _pollAfterStoreSuccess(userId: userId);
    } finally {
      _endOperation(operation);
    }
  }

  /// Restore prior purchases, then poll the server for the entitlement flip.
  Future<PaywallActionResult> restore() async {
    final userId = _userId;
    if (userId == null) return PaywallActionResult.error;
    final operation = _beginOperation();
    if (operation == null) return PaywallActionResult.error;
    try {
      _set(state.copyWith(phase: PaywallPhase.purchasing));
      final restoreAttempt = await _purchases.restorePurchases(userId);
      if (!_isCurrentUser(userId)) return PaywallActionResult.error;
      final immediateResult = immediateResultForRestore(restoreAttempt.outcome);
      if (immediateResult != null) {
        _set(state.copyWith(phase: PaywallPhase.ready, clearBusy: true));
        return immediateResult;
      }
      return await _pollAfterStoreSuccess(userId: userId);
    } finally {
      _endOperation(operation);
    }
  }

  /// Retry server activation after a deferred payment or webhook delay.
  /// This is deliberately user-triggered so pending states never become a
  /// permanent spinner or an unbounded background poll.
  Future<PaywallActionResult> retryActivation() async {
    final userId = _userId;
    if (userId == null) return PaywallActionResult.error;
    final operation = _beginOperation();
    if (operation == null) return PaywallActionResult.error;
    try {
      return await _pollAfterStoreSuccess(userId: userId);
    } finally {
      _endOperation(operation);
    }
  }

  Future<EntitlementState?> _preStoreEntitlement(String userId) async {
    final entitlements = ref.read(entitlementsProvider(userId).notifier);
    final lastReconcile = _lastPreStoreReconciledAt;
    if (lastReconcile != null &&
        DateTime.now().difference(lastReconcile) <
            _preStoreReconcileReuseWindow) {
      return entitlements.refreshSnapshot();
    }

    final entitlement = await entitlements.reconcile();
    if (entitlement?.purchasesEnabled == true && _isCurrentUser(userId)) {
      _lastPreStoreReconciledAt = DateTime.now();
    }
    return entitlement;
  }

  int? _beginOperation() {
    if (_activeOperation != null) return null;
    final operation = _operationGeneration;
    _activeOperation = operation;
    return operation;
  }

  void _endOperation(int operation) {
    if (_activeOperation == operation) {
      _activeOperation = null;
    }
  }

  /// Shared tail for a successful store call: flip to `verifying`, then poll the
  /// server until premium or timeout.
  Future<PaywallActionResult> _pollAfterStoreSuccess({
    required String userId,
  }) async {
    _set(state.copyWith(phase: PaywallPhase.verifying, clearBusy: true));
    // `purchase` already marked the attempt before the store call; `restore`
    // and `retryActivation` arrive here without one, and both can equally
    // surface a transaction the server has not projected yet.
    final pendingStore = ref.read(activationPendingStoreProvider);
    await pendingStore.mark(userId);
    final premium =
        await ref
            .read(entitlementsProvider(userId).notifier)
            .pollUntilPremium();
    if (premium) await pendingStore.clear(userId);
    if (!_isCurrentUser(userId)) return PaywallActionResult.error;
    // Leave the state on `verifying`→`ready` so the screen can dismiss / toast.
    _set(
      state.copyWith(
        phase: premium ? PaywallPhase.ready : PaywallPhase.activationPending,
      ),
    );
    // A confirmed store transaction can precede its webhook. Keep this pending
    // instead of misreporting a valid restore as "nothing to restore".
    return resultAfterEntitlementPoll(premium);
  }
}

final paywallControllerProvider =
    AutoDisposeNotifierProvider<PaywallController, PaywallState>(
      PaywallController.new,
    );
