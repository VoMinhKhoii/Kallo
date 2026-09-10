/// Plan arithmetic for the Kallo Pro screen: which packages the free face
/// offers, and the yearly plan's derived per-month and save-percent figures.
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
/// carries. Lifetime — and any other package the offering holds — is
/// deliberately dropped: the screen is a two-period decision, and a third
/// option turns the toggle back into a price list.
///
/// They are needed as a PAIR, not just individually: the yearly plan's saving
/// is measured against twelve of the monthly price.
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

/// Whether the sheet may PROMISE a free trial on [plan]: the account is not
/// already mid-trial, the product declares a free introductory period, and the
/// STORE says this customer is still eligible. A returning subscriber's product
/// carries `introductoryPrice` exactly like a new one's — only the store knows
/// Apple would refuse the trial at purchase.
bool offersTrial({
  required Package plan,
  required bool trialActive,
  required Set<String> eligibleProductIds,
}) =>
    !trialActive &&
    freeTrialDays(plan) > 0 &&
    eligibleProductIds.contains(plan.storeProduct.identifier);

/// Whether the sheet may promise a trial on [plan], and how long it would run
/// — one answer, asked once, because the CTA and the legal line under it are
/// two halves of the same promise.
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

/// The clock the renewal line's "from {date}" reads, behind a provider so a
/// test can pin the date without the screen growing a parameter for it.
final paywallClockProvider = Provider<DateTime Function()>((_) => DateTime.now);

/// The locale the STORE formatted `priceString` in — the DEVICE's, not the
/// app's. The billed amount and the derived per-month figure share one line,
/// so deriving the second in the app locale puts "24,99 US\$" beside "\$2.08"
/// for anyone whose phone and app disagree.
String deviceCurrencyLocale() => PlatformDispatcher.instance.locale.toString();

/// The yearly plan's derived figures.
class YearlyPricing {
  const YearlyPricing({
    required this.perMonth,
    this.savePercent,
  });

  /// The yearly price divided by twelve — "$2.08". The renewal line carries
  /// it in brackets AFTER the amount actually billed, never instead of it.
  final String perMonth;

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
