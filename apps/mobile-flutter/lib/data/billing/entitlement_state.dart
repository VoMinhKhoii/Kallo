/// Server-authoritative billing state shared by entitlement orchestration and
/// presentation layers.
library;

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
    required this.reconciliationRequired,
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
  final bool reconciliationRequired;
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
      reconciliationRequired: json['reconciliationRequired'] == true,
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
    reconciliationRequired: false,
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
