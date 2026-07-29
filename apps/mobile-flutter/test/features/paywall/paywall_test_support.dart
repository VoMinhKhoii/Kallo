import 'package:nham_mobile/data/api_client.dart';
import 'package:nham_mobile/data/billing/purchases_service.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

class PaywallEntitlementsApi extends ApiClient {
  PaywallEntitlementsApi({
    this.failPrePurchaseCheck = false,
    this.premiumBeforePurchase = false,
  });

  final bool failPrePurchaseCheck;
  final bool premiumBeforePurchase;
  bool purchasesEnabled = true;
  int getCalls = 0;
  int postCalls = 0;

  @override
  Future<T> get<T>(String path) async {
    getCalls += 1;
    return freeEntitlement(purchasesEnabled: purchasesEnabled) as T;
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
    return freeEntitlement(purchasesEnabled: purchasesEnabled) as T;
  }
}

class PaywallPurchasesService extends PurchasesService {
  PaywallPurchasesService({
    List<PurchaseOutcome> outcomes = const [PurchaseOutcome.success],
  }) : outcomes = [...outcomes],
       super(apiKey: '');

  final List<PurchaseOutcome> outcomes;
  int purchaseCalls = 0;

  @override
  bool get purchasesAvailable => true;

  @override
  Future<List<Package>> getPackages(String userId) async => [monthlyPackage];

  @override
  Future<PurchaseAttempt> purchasePackage(
    String userId,
    Package package,
  ) async {
    purchaseCalls += 1;
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

Map<String, dynamic> freeEntitlement({bool purchasesEnabled = true}) => {
  'tier': 'free',
  'purchasesEnabled': purchasesEnabled,
  'isLifetime': false,
  'expiresAt': null,
  'willRenew': false,
  'source': null,
  'hasActiveSubscription': false,
  'trial': {'active': true, 'endsAt': null, 'daysRemaining': 60},
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
