// The Kallo Pro sheet's plan selection and the yearly row's derived copy.
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/paywall/logic/plan_pricing.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

import 'paywall_test_support.dart';

Package _monthlyAt(double price, {String currency = 'USD'}) => Package(
  r'$rc_monthly',
  PackageType.monthly,
  StoreProduct(
    'kallo_premium_monthly',
    'Monthly',
    'Monthly',
    price,
    '\$$price',
    currency,
  ),
  offeringContext,
);

void main() {
  test('the plan list drops lifetime and puts the yearly plan first', () {
    final plans = visiblePlans([
      monthlyPackage,
      lifetimePackage,
      annualPackage,
    ]);

    expect(plans.map((p) => p.packageType), [
      PackageType.annual,
      PackageType.monthly,
    ]);
  });

  test('the default selection is the yearly plan', () {
    final plans = visiblePlans([monthlyPackage, annualPackage]);

    expect(defaultPlan(plans), annualPackage);
  });

  test('with no yearly plan the first one on offer is the default', () {
    expect(defaultPlan([monthlyPackage]), monthlyPackage);
    expect(defaultPlan(const []), isNull);
  });

  test('a free introductory period is measured in days', () {
    expect(freeTrialDays(annualPackage), 7);
    expect(freeTrialDays(monthlyPackage), 0);
  });

  test('the yearly row strikes twelve monthly payments', () {
    final pricing = yearlyPricing(
      annual: annualPackage,
      monthly: _monthlyAt(3.49),
      locale: 'en',
    );

    expect(pricing.struckYearly, r'$41.88');
    expect(pricing.perMonth, r'$2.08');
    expect(pricing.savePercent, 40);
  });

  test('without a monthly plan there is nothing to strike or boast', () {
    final pricing = yearlyPricing(
      annual: annualPackage,
      monthly: null,
      locale: 'en',
    );

    expect(pricing.struckYearly, isNull);
    expect(pricing.savePercent, isNull);
    expect(pricing.perMonth, r'$2.08');
  });

  test('a monthly plan in another currency is not compared against', () {
    final pricing = yearlyPricing(
      annual: annualPackage,
      monthly: _monthlyAt(89000, currency: 'VND'),
      locale: 'en',
    );

    expect(pricing.struckYearly, isNull);
    expect(pricing.savePercent, isNull);
  });

  test('omitting the locale falls back to the DEVICE one the store priced in',
      () {
    // The row shows `priceString` (formatted by the store, for the device)
    // beside these two; formatting them in the app locale instead is how
    // "24,99 US\$" ended up next to "\$41.88".
    final derived =
        yearlyPricing(annual: annualPackage, monthly: _monthlyAt(3.49));
    final device = yearlyPricing(
      annual: annualPackage,
      monthly: _monthlyAt(3.49),
      locale: deviceCurrencyLocale(),
    );

    expect(derived.perMonth, device.perMonth);
    expect(derived.struckYearly, device.struckYearly);
  });

  test('the trial promise needs the store\'s blessing, not just the offer', () {
    // Same product, four customers — only the first is promised days.
    for (final (why, plan, active, eligible, promised) in [
      ('eligible', annualPackage, false, {'kallo_premium_annual'}, true),
      ('the store refuses them', annualPackage, false, <String>{}, false),
      ('already mid-trial', annualPackage, true, {'kallo_premium_annual'}, false),
      ('no introductory period', monthlyPackage, false, {'kallo_premium_monthly'}, false),
    ]) {
      expect(
        offersTrial(
          plan: plan,
          trialActive: active,
          eligibleProductIds: eligible,
        ),
        promised,
        reason: why,
      );
    }
  });

  test('the saving rounds to the nearest 5 and hides when there is none', () {
    expect(savePercent(annual: 24.99, monthlyYear: 41.88), 40);
    expect(savePercent(annual: 100, monthlyYear: 120), 15);
    expect(savePercent(annual: 120, monthlyYear: 120), isNull);
    expect(savePercent(annual: 130, monthlyYear: 120), isNull);
    expect(savePercent(annual: 24.99, monthlyYear: 0), isNull);
  });
}
