/// Plan arithmetic for the Kallo Pro sheet: which packages the free face
/// offers, and the yearly row's derived strike / per-month / save-percent copy.
///
/// Everything here is DERIVED from the live store product (price + currency
/// code), never from a hardcoded number: the App Store and Play localize and
/// re-tier prices per storefront, so a baked "$41.88" would be wrong in most
/// of the world the moment it shipped.
library;

import 'dart:ui' show PlatformDispatcher;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

/// The two packages the free face is about, out of whatever the offering
/// carries. One walk, one place that knows which types those are: the sheet
/// needs the pair in order for its rows AND as a pair for their copy (the
/// yearly row strikes twelve of the monthly price).
({Package? annual, Package? monthly}) splitPlans(List<Package> packages) => (
      annual: _firstOfType(packages, PackageType.annual),
      monthly: _firstOfType(packages, PackageType.monthly),
    );

Package? _firstOfType(List<Package> packages, PackageType type) {
  for (final package in packages) {
    if (package.packageType == type) return package;
  }
  return null;
}

/// The plans the free paywall shows, yearly first.
///
/// Lifetime — and any other package the offering happens to carry, a second
/// annual tier included — is deliberately absent: the sheet is a two-choice
/// decision, and a third row turns it back into a price list.
List<Package> visiblePlans(List<Package> packages) {
  final split = splitPlans(packages);
  return [
    if (split.annual != null) split.annual!,
    if (split.monthly != null) split.monthly!,
  ];
}

/// The plan that is selected before the user picks: the yearly one, or the
/// first on offer when the offering has no annual package.
Package? defaultPlan(List<Package> plans) {
  if (plans.isEmpty) return null;
  for (final plan in plans) {
    if (plan.packageType == PackageType.annual) return plan;
  }
  return plans.first;
}

/// Days of FREE introductory access [package] offers, or 0 when it offers
/// none. A paid introductory price is not a trial and returns 0.
int freeTrialDays(Package package) {
  final intro = package.storeProduct.introductoryPrice;
  if (intro == null || intro.price != 0) return 0;
  final cycles = intro.cycles <= 0 ? 1 : intro.cycles;
  final units = intro.periodNumberOfUnits * cycles;
  return switch (intro.periodUnit) {
    PeriodUnit.day => units,
    PeriodUnit.week => units * 7,
    PeriodUnit.month => units * 30,
    PeriodUnit.year => units * 365,
    PeriodUnit.unknown => 0,
  };
}

/// Whether the sheet may PROMISE a free trial on [plan].
///
/// Three things have to hold, and the product alone cannot answer the third:
/// the account is not already mid-trial, the product declares a free
/// introductory period, and the STORE says this customer is still eligible for
/// it. A returning subscriber's product carries `introductoryPrice` exactly
/// like a new one's — Apple simply refuses the trial at purchase — so copy
/// driven by the declaration alone promises seven free days it cannot deliver.
bool offersTrial({
  required Package plan,
  required bool trialActive,
  required Set<String> eligibleProductIds,
}) =>
    !trialActive &&
    freeTrialDays(plan) > 0 &&
    eligibleProductIds.contains(plan.storeProduct.identifier);

/// Whether the sheet may promise a trial on [plan], and how long it would run.
///
/// One answer, asked once: the CTA and the legal line under it are two halves
/// of the same promise, and each deciding for itself is how they come to
/// disagree.
({bool trial, int days}) trialOffer({
  required Package plan,
  required bool trialActive,
  required Set<String> eligibleProductIds,
}) =>
    (
      trial: offersTrial(
        plan: plan,
        trialActive: trialActive,
        eligibleProductIds: eligibleProductIds,
      ),
      days: freeTrialDays(plan),
    );

/// The clock the legal line's "starting {date}" reads, behind a provider so a
/// test can pin the date without the sheet growing a parameter for it.
final paywallClockProvider = Provider<DateTime Function()>((_) => DateTime.now);

/// The locale the STORE formatted `priceString` in — the DEVICE's, not the
/// app's.
///
/// All three figures on the yearly row share one line: the store's own price
/// string, the struck twelve months and the per-month. `priceString` comes back
/// formatted for the device locale, so deriving the other two in the app locale
/// puts "24,99 US\$" beside "\$41.88" for anyone whose phone and app disagree.
String deviceCurrencyLocale() => PlatformDispatcher.instance.locale.toString();

/// What the yearly row says under its name.
class YearlyPricing {
  const YearlyPricing({
    required this.perMonth,
    this.struckYearly,
    this.savePercent,
  });

  /// The yearly price divided by twelve — "$2.08".
  final String perMonth;

  /// Twelve monthly payments, struck through. Null when the monthly package is
  /// absent (or priced in another currency): there is then nothing honest to
  /// strike, so the row shows the per-month line alone.
  final String? struckYearly;

  /// Saving against those twelve payments, to the nearest 5. Null hides the
  /// chip rather than boasting a number that cannot be computed.
  final int? savePercent;
}

YearlyPricing yearlyPricing({
  required Package annual,
  required Package? monthly,
  String? locale,
}) {
  final product = annual.storeProduct;
  final money = NumberFormat.simpleCurrency(
    locale: locale ?? deviceCurrencyLocale(),
    name: product.currencyCode,
  );
  final perMonth = money.format(product.price / 12);
  final monthlyProduct = monthly?.storeProduct;
  if (monthlyProduct == null ||
      monthlyProduct.currencyCode != product.currencyCode) {
    return YearlyPricing(perMonth: perMonth);
  }
  final twelve = monthlyProduct.price * 12;
  return YearlyPricing(
    perMonth: perMonth,
    struckYearly: money.format(twelve),
    savePercent: savePercent(annual: product.price, monthlyYear: twelve),
  );
}

/// The yearly saving against twelve monthly payments, rounded to the nearest
/// 5%. Null when the yearly plan is not actually cheaper — a "save 0%" chip is
/// worse than no chip.
int? savePercent({required double annual, required double monthlyYear}) {
  if (annual <= 0 || monthlyYear <= 0 || annual >= monthlyYear) return null;
  final percent = ((1 - annual / monthlyYear) * 100 / 5).round() * 5;
  return percent <= 0 ? null : percent;
}
