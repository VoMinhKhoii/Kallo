import 'package:kallo_mobile/services/billing/activation_pending.dart';
import 'package:kallo_mobile/services/http/api_client.dart';
import 'package:kallo_mobile/services/billing/purchases_service.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

class PaywallEntitlementsApi extends ApiClient {
  PaywallEntitlementsApi({
    this.failPrePurchaseCheck = false,
    this.premiumBeforePurchase = false,
    this.trialActive = true,
  });

  final bool failPrePurchaseCheck;
  final bool premiumBeforePurchase;
  final bool trialActive;
  bool purchasesEnabled = true;
  int getCalls = 0;
  int postCalls = 0;

  @override
  Future<T> get<T>(String path) async {
    getCalls += 1;
    return freeEntitlement(
      purchasesEnabled: purchasesEnabled,
      trialActive: trialActive,
    ) as T;
  }

  @override
  Future<T> post<T>(String path, [Object? body]) async {
    postCalls += 1;
    if (failPrePurchaseCheck && postCalls == 1) {
      throw ApiError(
        'UPSTREAM_UNAVAILABLE',
        503,
        true,
        'Could not verify purchases.',
      );
    }
    if (premiumBeforePurchase || postCalls > 1) {
      return premiumEntitlement() as T;
    }
    return freeEntitlement(
      purchasesEnabled: purchasesEnabled,
      trialActive: trialActive,
    ) as T;
  }
}

class PaywallPurchasesService extends PurchasesService {
  PaywallPurchasesService({
    List<PurchaseOutcome> outcomes = const [PurchaseOutcome.success],
    this.packages = const [monthlyPackage],
    this.trialEligibleIds,
  }) : outcomes = [...outcomes],
       super(apiKey: '');

  /// Which product ids the store would still start a trial on. `null` — the
  /// default — means "every id asked about", so a test that is not about
  /// eligibility gets the same copy the product's own introductory offer
  /// implies. Pass `{}` for a returning subscriber the store would refuse.
  final Set<String>? trialEligibleIds;

  @override
  Future<Set<String>> trialEligibleProductIds(List<String> productIds) async =>
      trialEligibleIds ?? productIds.toSet();

  final List<PurchaseOutcome> outcomes;

  /// What the offering hands back. The default keeps the controller tests on
  /// the single package they were written against.
  final List<Package> packages;

  int purchaseCalls = 0;

  /// The package the last purchase call was made for — how a UI test proves
  /// the CTA bought the row the user picked.
  Package? lastPurchased;

  @override
  bool get purchasesAvailable => true;

  @override
  Future<List<Package>> getPackages(String userId) async => packages;

  @override
  Future<PurchaseAttempt> purchasePackage(
    String userId,
    Package package,
  ) async {
    purchaseCalls += 1;
    lastPurchased = package;
    final outcome =
        outcomes.isEmpty ? PurchaseOutcome.success : outcomes.removeAt(0);
    return PurchaseAttempt(outcome);
  }
}

Map<String, dynamic> premiumEntitlement() => {
  'tier': 'premium',
  'purchasesEnabled': true,
  'isLifetime': false,
  'expiresAt': '2026-08-01T00:00:00.000Z',
  'willRenew': true,
  'source': 'app_store',
  'hasActiveSubscription': true,
  'trial': {'active': false, 'endsAt': null, 'daysRemaining': 0},
  'features': {
    'ai_analysis': {'allowed': true, 'reason': 'entitled'},
  },
};

Map<String, dynamic> freeEntitlement({
  bool purchasesEnabled = true,
  bool trialActive = true,
}) => {
  'tier': 'free',
  'purchasesEnabled': purchasesEnabled,
  'isLifetime': false,
  'expiresAt': null,
  'willRenew': false,
  'source': null,
  'hasActiveSubscription': false,
  'trial': {
    'active': trialActive,
    'endsAt': null,
    'daysRemaining': trialActive ? 60 : 0,
  },
  'features': {
    'ai_analysis': {'allowed': true, 'reason': 'trial'},
  },
};

const offeringContext = PresentedOfferingContext('default', null, null);
const monthlyProduct = StoreProduct(
  'kallo_premium_monthly',
  'Monthly Kallo Premium',
  'Kallo Premium Monthly',
  9.99,
  r'$9.99',
  'USD',
  presentedOfferingContext: offeringContext,
  subscriptionPeriod: 'P1M',
);
const monthlyPackage = Package(
  r'$rc_monthly',
  PackageType.monthly,
  monthlyProduct,
  offeringContext,
);

/// A yearly plan carrying a 7-day free introductory period, priced against
/// [monthlyProduct] the way the design reference is: twelve monthly payments
/// struck, the annual price shown.
const annualProduct = StoreProduct(
  'kallo_premium_annual',
  'Annual Kallo Premium',
  'Kallo Premium Annual',
  24.99,
  r'$24.99',
  'USD',
  presentedOfferingContext: offeringContext,
  subscriptionPeriod: 'P1Y',
  introductoryPrice: IntroductoryPrice(0, 'Free', 'P7D', 1, PeriodUnit.day, 7),
);
const annualPackage = Package(
  r'$rc_annual',
  PackageType.annual,
  annualProduct,
  offeringContext,
);

/// The same yearly plan WITHOUT an introductory offer — a storefront that
/// never carried one, as opposed to a customer who has used theirs up.
const annualNoTrialProduct = StoreProduct(
  'kallo_premium_annual',
  'Annual Kallo Premium',
  'Kallo Premium Annual',
  24.99,
  r'$24.99',
  'USD',
  presentedOfferingContext: offeringContext,
  subscriptionPeriod: 'P1Y',
);
const annualNoTrialPackage = Package(
  r'$rc_annual',
  PackageType.annual,
  annualNoTrialProduct,
  offeringContext,
);

const lifetimeProduct = StoreProduct(
  'kallo_premium_lifetime',
  'Lifetime Kallo Premium',
  'Kallo Premium Lifetime',
  99.99,
  r'$99.99',
  'USD',
  presentedOfferingContext: offeringContext,
);
const lifetimePackage = Package(
  r'$rc_lifetime',
  PackageType.lifetime,
  lifetimeProduct,
  offeringContext,
);

/// In-memory [ActivationPendingStore]. The real one writes through
/// `flutter_secure_storage`, whose platform-channel reply never arrives inside
/// a widget test's fake-async zone — a purchase would hang forever on `mark`.
class FakeActivationPendingStore implements ActivationPendingStore {
  final marked = <String>{};

  @override
  Future<void> mark(String userId) async => marked.add(userId);

  @override
  Future<void> clear(String userId) async => marked.remove(userId);

  @override
  Future<bool> isPending(String userId) async => marked.contains(userId);

  @override
  Future<void> recordRecoveryAttempt(String userId) async {}
}
