/// Entitlement state — the SERVER-authoritative subscription status that drives
/// every gating decision in the app.
///
/// Fetches `GET /api/v1/account/entitlements` through the existing [ApiClient].
/// The RC SDK is only for purchase/restore UX; this endpoint is the source of
/// truth for tier / trial / feature access. After a purchase or restore the
/// client polls [pollUntilPremium] with backoff (the server learns via the RC
/// webhook — the client must never self-grant).
library;

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api_client.dart';
import '../session_provider.dart';

/// Subscription tier. Unknown values from the server parse to [free] (safe
/// default — never over-grant on a parse miss).
enum EntitlementTier { free, premium }

/// Why a feature is (or isn't) allowed — mirrors the server `reason` union.
enum FeatureReason { entitled, trial, trialExpired, notEntitled }

FeatureReason _parseReason(Object? raw) => switch (raw) {
  'entitled' => FeatureReason.entitled,
  'trial' => FeatureReason.trial,
  'trial_expired' => FeatureReason.trialExpired,
  _ => FeatureReason.notEntitled,
};

/// Access decision for a single gated feature (`features.<name>`).
class FeatureAccess {
  const FeatureAccess({required this.allowed, required this.reason});

  final bool allowed;
  final FeatureReason reason;

  factory FeatureAccess.fromJson(Map<String, dynamic>? json) => FeatureAccess(
    allowed: json?['allowed'] == true,
    reason: _parseReason(json?['reason']),
  );

  static const denied = FeatureAccess(
    allowed: false,
    reason: FeatureReason.notEntitled,
  );
}

/// Free-trial window from the `trial` object.
class TrialState {
  const TrialState({
    required this.active,
    required this.endsAt,
    required this.daysRemaining,
  });

  final bool active;
  final DateTime? endsAt;
  final int daysRemaining;

  factory TrialState.fromJson(Map<String, dynamic>? json) => TrialState(
    active: json?['active'] == true,
    endsAt: _parseDate(json?['endsAt']),
    daysRemaining:
        json?['daysRemaining'] is int ? json!['daysRemaining'] as int : 0,
  );

  static const none = TrialState(active: false, endsAt: null, daysRemaining: 0);
}

/// The full parsed entitlement snapshot.
class EntitlementState {
  const EntitlementState({
    required this.tier,
    required this.purchasesEnabled,
    required this.isLifetime,
    required this.expiresAt,
    required this.willRenew,
    required this.source,
    required this.store,
    required this.managementUrl,
    required this.managementStore,
    required this.hasActiveSubscription,
    required this.trial,
    required this.aiAnalysis,
  });

  final EntitlementTier tier;
  final bool purchasesEnabled;
  final bool isLifetime;
  final DateTime? expiresAt;
  final bool willRenew;
  final String? source;
  final String? store;
  final String? managementUrl;
  final String? managementStore;
  final bool hasActiveSubscription;
  final TrialState trial;

  /// Access decision for the `ai_analysis` feature — the one gated capability
  /// this phase wires (the paywall is AI-analysis focused).
  final FeatureAccess aiAnalysis;

  bool get isPremium => tier == EntitlementTier.premium;

  /// True when the ONLY thing keeping the user premium is an active trial —
  /// drives the trial-countdown copy on the paywall / settings.
  bool get isTrialing =>
      purchasesEnabled && trial.active && !hasActiveSubscription && !isLifetime;

  factory EntitlementState.fromJson(Map<String, dynamic> json) {
    final features = json['features'] as Map<String, dynamic>?;
    return EntitlementState(
      tier:
          json['tier'] == 'premium'
              ? EntitlementTier.premium
              : EntitlementTier.free,
      purchasesEnabled: json['purchasesEnabled'] == true,
      isLifetime: json['isLifetime'] == true,
      expiresAt: _parseDate(json['expiresAt']),
      willRenew: json['willRenew'] == true,
      source: json['source'] as String?,
      store: json['store'] as String?,
      managementUrl: json['managementUrl'] as String?,
      managementStore: json['managementStore'] as String?,
      hasActiveSubscription: json['hasActiveSubscription'] == true,
      trial: TrialState.fromJson(json['trial'] as Map<String, dynamic>?),
      aiAnalysis: FeatureAccess.fromJson(
        features?['ai_analysis'] as Map<String, dynamic>?,
      ),
    );
  }

  /// Conservative fallback used before the first fetch resolves / on a hard
  /// error: free, no trial, AI locked. Never over-grants.
  static const free = EntitlementState(
    tier: EntitlementTier.free,
    purchasesEnabled: false,
    isLifetime: false,
    expiresAt: null,
    willRenew: false,
    source: null,
    store: null,
    managementUrl: null,
    managementStore: null,
    hasActiveSubscription: false,
    trial: TrialState.none,
    aiAnalysis: FeatureAccess.denied,
  );
}

DateTime? _parseDate(Object? raw) {
  if (raw is! String || raw.isEmpty) return null;
  return DateTime.tryParse(raw);
}

/// Fetches + caches the server entitlement snapshot. `refresh()` re-fetches;
/// `pollUntilPremium()` runs the post-purchase backoff poll.
class EntitlementsController
    extends AutoDisposeFamilyAsyncNotifier<EntitlementState, String?> {
  String? _ownerUserId;
  bool _disposed = false;

  @override
  Future<EntitlementState> build(String? userId) {
    _ownerUserId = userId;
    ref.onDispose(() => _disposed = true);

    if (userId == null) {
      return Future.value(EntitlementState.free);
    }

    return _fetch();
  }

  Future<EntitlementState> _fetch() async {
    final api = ref.read(apiClientProvider);
    final json = await api.get<Map<String, dynamic>>(
      '/api/v1/account/entitlements',
    );
    return EntitlementState.fromJson(json);
  }

  Future<EntitlementState> _reconcile() async {
    final api = ref.read(apiClientProvider);
    final json = await api.post<Map<String, dynamic>>(
      '/api/v1/account/entitlements/reconcile',
    );
    return EntitlementState.fromJson(json);
  }

  /// Re-fetch the snapshot, surfacing loading/error through the AsyncValue.
  Future<void> refresh() async {
    state = const AsyncValue.loading();
    await refreshSnapshot();
  }

  /// Fetch the server-owned entitlement state without asking RevenueCat to
  /// reconcile. Use this for pre-purchase commerce checks; provider
  /// reconciliation is reserved for recovery and post-store verification.
  ///
  /// Returns `null` on a transport/server failure so callers can distinguish
  /// "could not verify" from an explicit `purchasesEnabled: false`.
  Future<EntitlementState?> refreshSnapshot() async {
    final operation = _captureOperation();
    if (operation == null) {
      state = const AsyncData(EntitlementState.free);
      return EntitlementState.free;
    }

    return _keepAliveWhile(() async {
      final previous = state.valueOrNull;
      try {
        final snapshot = await _fetch();
        if (!_isCurrent(operation)) return null;

        state = AsyncData(snapshot);
        return snapshot;
      } catch (error, stackTrace) {
        if (!_isCurrent(operation)) return null;

        // A pre-purchase safety refresh must not erase the last known-good
        // entitlement snapshot. The caller still receives null and blocks this
        // attempt, while the real screen keeps its packages available to retry.
        state =
            previous == null
                ? AsyncError(error, stackTrace)
                : AsyncData(previous);
        return null;
      }
    });
  }

  Future<EntitlementState?> reconcile() async {
    final operation = _captureOperation();
    if (operation == null) {
      state = const AsyncData(EntitlementState.free);
      return EntitlementState.free;
    }

    return _keepAliveWhile(() async {
      final snapshot = await AsyncValue.guard(_reconcile);
      if (!_isCurrent(operation)) return null;

      state = snapshot;
      return snapshot.valueOrNull;
    });
  }

  /// After a successful purchase/restore, poll the server until the tier flips
  /// to premium (the server learns asynchronously via the RC webhook). Polls
  /// every [interval] up to [timeout]; updates [state] as it goes. Returns
  /// `true` once premium is observed, `false` if the window elapses first.
  ///
  /// The client NEVER self-grants — it only reflects what the server reports.
  Future<bool> pollUntilPremium({
    Duration interval = const Duration(seconds: 2),
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final operation = _captureOperation();
    if (operation == null) return false;

    return _keepAliveWhile(() async {
      final deadline = DateTime.now().add(timeout);

      // Reconcile with the provider once after the store action. Follow-up
      // checks are local entitlement reads so a slow webhook does not amplify
      // into repeated RevenueCat API calls.
      final reconciled = await AsyncValue.guard(_reconcile);
      if (!_isCurrent(operation)) return false;
      state = reconciled;
      if (reconciled.valueOrNull?.isPremium ?? false) return true;

      while (DateTime.now().isBefore(deadline)) {
        final remaining = deadline.difference(DateTime.now());
        if (remaining <= Duration.zero) break;
        await Future<void>.delayed(remaining < interval ? remaining : interval);
        if (!_isCurrent(operation)) return false;

        final snapshot = await AsyncValue.guard(_fetch);
        if (!_isCurrent(operation)) return false;
        state = snapshot;
        if (snapshot.valueOrNull?.isPremium ?? false) return true;
      }

      return _isCurrent(operation) && (state.valueOrNull?.isPremium ?? false);
    });
  }

  Future<T> _keepAliveWhile<T>(Future<T> Function() operation) async {
    final keepAlive = ref.keepAlive();
    try {
      return await operation();
    } finally {
      keepAlive.close();
    }
  }

  String? _captureOperation() {
    if (_disposed) return null;
    final userId = ref.read(entitlementsUserIdProvider);
    if (userId == null || userId != _ownerUserId) return null;

    return userId;
  }

  bool _isCurrent(String userId) {
    return !_disposed &&
        userId == _ownerUserId &&
        userId == ref.read(entitlementsUserIdProvider);
  }
}

/// The authenticated identity that owns the cached entitlement snapshot.
/// Watching it makes auth changes invalidate the snapshot immediately.
final entitlementsUserIdProvider = Provider<String?>((ref) {
  return ref.watch(currentSessionProvider)?.user.id;
});

final entitlementsProvider = AsyncNotifierProvider.autoDispose
    .family<EntitlementsController, EntitlementState, String?>(
      EntitlementsController.new,
    );
