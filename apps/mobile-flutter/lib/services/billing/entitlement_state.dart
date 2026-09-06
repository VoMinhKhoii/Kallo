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

/// The gated feature names the server keys `features` by. Mirrors
/// `PREMIUM_FEATURES` on the server; used only to name lock affordances.
class PremiumFeature {
  const PremiumFeature._();

  static const aiAnalysis = 'ai_analysis';
  static const labelScan = 'label_scan';
  static const micronutrients = 'micronutrients';
  static const relog = 'relog';
  static const cheatMeal = 'cheat_meal';
  static const copySplit = 'copy_split';
  static const unlimitedCircle = 'unlimited_circle';
}

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
    required this.features,
    required this.enforcementEnabled,
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

  /// Every gated feature the server reported, keyed by [PremiumFeature] name.
  ///
  /// UX-ONLY. This map exists so the client can show a lock or an upsell
  /// BEFORE the user spends a round trip — never to decide whether an action
  /// may proceed. Enforcement is the server's HTTP 402, always.
  final Map<String, FeatureAccess> features;

  /// Whether the server is currently ENFORCING the gates. While false the
  /// server 402s nothing, so lock affordances must stay hidden even for a
  /// feature reported as not allowed. It may only ever suppress lock UI — it
  /// must never be read as permission to do something.
  final bool enforcementEnabled;

  /// Access decision for one feature; unknown/absent names read denied.
  FeatureAccess featureAccess(String feature) =>
      features[feature] ?? FeatureAccess.denied;

  /// Whether a lock/upsell affordance should be shown for [feature]. False
  /// while enforcement is off — nothing is actually gated then.
  bool showsLockFor(String feature) =>
      enforcementEnabled && !featureAccess(feature).allowed;

  /// Access decision for the `ai_analysis` feature (the paywall's headline
  /// capability). Kept as a named accessor for the existing call sites.
  FeatureAccess get aiAnalysis => featureAccess(PremiumFeature.aiAnalysis);

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
      features: _parseFeatures(features),
      // Absent on a server that predates the rollout flag: default OFF, so an
      // old payload shows no locks rather than locking everything.
      enforcementEnabled: json['enforcementEnabled'] == true,
    );
  }

  /// Conservative fallback used before the first fetch resolves / on a hard
  /// error: free, no trial, every feature locked. Never over-grants.
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
    features: {},
    enforcementEnabled: false,
  );
}

/// Decode the `features` object. Anything that isn't a well-formed entry is
/// dropped rather than fabricated — a missing key already reads denied.
Map<String, FeatureAccess> _parseFeatures(Map<String, dynamic>? raw) {
  if (raw == null) return const {};
  return {
    for (final entry in raw.entries)
      if (entry.value is Map<String, dynamic>)
        entry.key: FeatureAccess.fromJson(entry.value as Map<String, dynamic>),
  };
}

DateTime? _parseDate(Object? raw) {
  if (raw is! String || raw.isEmpty) return null;
  return DateTime.tryParse(raw);
}
