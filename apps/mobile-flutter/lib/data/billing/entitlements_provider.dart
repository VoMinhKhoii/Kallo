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
    required this.isLifetime,
    required this.expiresAt,
    required this.willRenew,
    required this.source,
    required this.trial,
    required this.aiAnalysis,
  });

  final EntitlementTier tier;
  final bool isLifetime;
  final DateTime? expiresAt;
  final bool willRenew;
  final String? source;
  final TrialState trial;

  /// Access decision for the `ai_analysis` feature — the one gated capability
  /// this phase wires (the paywall is AI-analysis focused).
  final FeatureAccess aiAnalysis;

  bool get isPremium => tier == EntitlementTier.premium;

  /// True when the ONLY thing keeping the user premium is an active trial —
  /// drives the trial-countdown copy on the paywall / settings.
  bool get isTrialing => trial.active;

  factory EntitlementState.fromJson(Map<String, dynamic> json) {
    final features = json['features'] as Map<String, dynamic>?;
    return EntitlementState(
      tier:
          json['tier'] == 'premium'
              ? EntitlementTier.premium
              : EntitlementTier.free,
      isLifetime: json['isLifetime'] == true,
      expiresAt: _parseDate(json['expiresAt']),
      willRenew: json['willRenew'] == true,
      source: json['source'] as String?,
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
    isLifetime: false,
    expiresAt: null,
    willRenew: false,
    source: null,
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
class EntitlementsController extends AsyncNotifier<EntitlementState> {
  @override
  Future<EntitlementState> build() => _fetch();

  Future<EntitlementState> _fetch() async {
    final api = ref.read(apiClientProvider);
    final json = await api.get<Map<String, dynamic>>(
      '/api/v1/account/entitlements',
    );
    return EntitlementState.fromJson(json);
  }

  /// Re-fetch the snapshot, surfacing loading/error through the AsyncValue.
  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(_fetch);
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
    final deadline = DateTime.now().add(timeout);
    while (DateTime.now().isBefore(deadline)) {
      final snapshot = await AsyncValue.guard(_fetch);
      state = snapshot;
      final value = snapshot.valueOrNull;
      if (value != null && value.isPremium) return true;
      // Don't overshoot the deadline on the final sleep.
      final remaining = deadline.difference(DateTime.now());
      if (remaining <= Duration.zero) break;
      await Future<void>.delayed(remaining < interval ? remaining : interval);
    }
    return state.valueOrNull?.isPremium ?? false;
  }
}

final entitlementsProvider =
    AsyncNotifierProvider<EntitlementsController, EntitlementState>(
      EntitlementsController.new,
    );
