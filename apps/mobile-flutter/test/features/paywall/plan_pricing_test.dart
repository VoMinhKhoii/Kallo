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
  IntroOffer? offerFor(Package plan, {bool trialActive = false}) => introOffer(
    plan: plan,
    trialActive: trialActive,
    eligibleProductIds: {plan.storeProduct.identifier},
  );

  test('a free introductory period is measured in days', () {
    expect(offerFor(annualPackage), isA<FreeTrial>());
    expect(offerFor(annualPackage)!.days, 7);
    expect(offerFor(monthlyPackage), isNull);
  });

  test('a paid first week is an intro offer, not a free trial', () {
    for (final plan in [annualPaidWeekPackage, monthlyPaidWeekPackage]) {
      final offer = offerFor(plan);
      expect(offer, isA<PaidIntro>());
      expect(offer!.days, 7);
      expect((offer as PaidIntro).price, r'$0.99');
    }
    // A free introductory period is not a paid one.
    expect(offerFor(annualPackage), isNot(isA<PaidIntro>()));
    expect(offerFor(monthlyPackage), isNull);
  });

  test('the paid week does not wait on an app-level trial', () {
    expect(
      offerFor(annualPaidWeekPackage, trialActive: true),
      isA<PaidIntro>(),
    );
  });

  test('a customer who used their paid week is offered the full price', () {
    expect(
      introOffer(
        plan: annualPaidWeekPackage,
        trialActive: false,
        eligibleProductIds: const {},
      ),
      isNull,
    );
  });

  test('the shipped prices save 70% (USD) and 30% (VND) a year', () {
    expect(savePercent(annual: 34.99, monthlyYear: 8.99 * 12), 70);
    expect(savePercent(annual: 499000, monthlyYear: 59000 * 12), 30);
  });

  test('the saving is measured against twelve monthly payments', () {
    final pricing = yearlyPricing(
      annual: annualPackage,
      monthly: _monthlyAt(3.49),
      locale: 'en',
    );

    expect(pricing.perMonth, r'$2.08');
    expect(pricing.savePercent, 40);
  });

  test('without a monthly plan there is nothing to boast', () {
    final pricing = yearlyPricing(
      annual: annualPackage,
      monthly: null,
      locale: 'en',
    );

    expect(pricing.savePercent, isNull);
    expect(pricing.perMonth, r'$2.08');
  });

  test('a monthly plan in another currency is not compared against', () {
    final pricing = yearlyPricing(
      annual: annualPackage,
      monthly: _monthlyAt(89000, currency: 'VND'),
      locale: 'en',
    );

    expect(pricing.savePercent, isNull);
    // The per-month figure is still honest — it is derived from the yearly
    // price alone, and only the COMPARISON needs a second currency to match.
    expect(pricing.perMonth, r'$2.08');
  });

  test(
    'omitting the locale falls back to the DEVICE one the store priced in',
    () {
      // The renewal line shows `priceString` (formatted by the store, for the
      // device) beside the derived per-month figure; formatting that in the app
      // locale instead is how "24,99 US\$" ended up next to "\$2.08".
      final derived = yearlyPricing(
        annual: annualPackage,
        monthly: _monthlyAt(3.49),
      );
      final device = yearlyPricing(
        annual: annualPackage,
        monthly: _monthlyAt(3.49),
        locale: deviceCurrencyLocale(),
      );

      expect(derived.perMonth, device.perMonth);
      expect(derived.savePercent, device.savePercent);
    },
  );

  test('the trial promise needs the store\'s blessing, not just the offer', () {
    // Same product, four customers — only the first is promised days.
    for (final (why, plan, active, eligible, promised) in [
      ('eligible', annualPackage, false, {'kallo_premium_annual'}, true),
      ('the store refuses them', annualPackage, false, <String>{}, false),
      (
        'already mid-trial',
        annualPackage,
        true,
        {'kallo_premium_annual'},
        false,
      ),
      (
        'no introductory period',
        monthlyPackage,
        false,
        {'kallo_premium_monthly'},
        false,
      ),
    ]) {
      expect(
        introOffer(
              plan: plan,
              trialActive: active,
              eligibleProductIds: eligible,
            )
            is FreeTrial,
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
