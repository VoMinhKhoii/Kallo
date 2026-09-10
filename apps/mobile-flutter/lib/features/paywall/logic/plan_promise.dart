/// The copy for the two halves of the promise the paywall makes: the buy
/// button's label and the renewal line under it. They are derived from the
/// same `trialOffer` answer, so they live together — a button that says "Start
/// 7-day trial" over a line that names no trial is the bug this pairing
/// prevents.
///
/// **Apple, April 2026.** Cal AI — this app's closest analogue — was pulled
/// for, among other things, showing a derived per-month figure more
/// prominently than the amount actually billed, with the renewal terms behind
/// a toggle. So the yearly line leads with the YEAR price and carries the
/// per-month figure in brackets after it, and the line is never hidden.
///
/// Pure: the caller hands in the locale and the clock rather than these
/// reaching for a `BuildContext`.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

/// What the buy button says.
///
/// "Start {n}-day trial" only when there IS one to start. Otherwise the
/// monthly plan names its own price on the button — it has no trial and no
/// saving to lead with, so the price is the most useful thing there — and the
/// yearly plan without a trial falls back to the plain "Start Premium".
String planCtaLabel({
  required Package? plan,
  required ({bool trial, int days}) offer,
  required bool trialActive,
}) {
  if (offer.trial) {
    return tr('paywall.startTrialDays', namedArgs: {'days': '${offer.days}'});
  }
  if (plan != null && plan.packageType == PackageType.monthly) {
    return tr(
      'paywall.startMonthly',
      namedArgs: {'price': plan.storeProduct.priceString},
    );
  }
  return tr(trialActive ? 'paywall.purchaseTrial' : 'paywall.purchase');
}

/// The line under the button: what will be charged, when it starts, and that
/// it repeats until cancelled.
///
/// Falls back to the plain legal sentence when there is no [plan] at all —
/// the store-closed face, which still owes the user its terms with nothing to
/// sell. [perMonth] is the yearly price divided by twelve, already formatted
/// in the STORE's currency and locale (`yearlyPricing`); it is ignored on the
/// monthly plan, which has no derived figure to show.
String planRenewalLine({
  required Package? plan,
  required String? perMonth,
  required ({bool trial, int days}) offer,
  required String locale,
  required DateTime now,
}) {
  if (plan == null) return tr('paywall.legal');
  final price = plan.storeProduct.priceString;
  final annual = plan.packageType == PackageType.annual;
  // Only a trial defers the first charge. Without one the subscription starts
  // now, and naming a date would be an invented grace period.
  final starts = offer.trial
      ? DateFormat.MMMd(locale).format(now.add(Duration(days: offer.days)))
      : null;
  if (annual && perMonth != null) {
    return tr(
      starts == null ? 'paywall.renewYearlyNow' : 'paywall.renewYearly',
      namedArgs: {
        'price': price,
        'perMonth': perMonth,
        if (starts != null) 'date': starts,
      },
    );
  }
  return tr(
    starts == null ? 'paywall.renewMonthly' : 'paywall.renewMonthlyFrom',
    namedArgs: {'price': price, if (starts != null) 'date': starts},
  );
}
