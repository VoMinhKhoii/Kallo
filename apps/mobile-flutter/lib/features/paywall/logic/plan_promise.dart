/// The copy for the two halves of the promise the plan sheet makes: the CTA
/// label and the legal line under it. They are derived from the same
/// `trialOffer` answer, so they live together — a CTA that says "Start free
/// trial" over a legal line that names no trial is the bug this pairing
/// prevents.
///
/// Pure: the sheet hands in the locale and the clock rather than these
/// reaching for a `BuildContext`.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

/// "Start free trial" only when there IS one to start; otherwise the
/// pre-existing purchase / purchaseTrial pair stands.
String planCtaLabel({
  required ({bool trial, int days}) offer,
  required bool trialActive,
}) {
  if (offer.trial) return tr('paywall.startFreeTrial');
  return tr(trialActive ? 'paywall.purchaseTrial' : 'paywall.purchase');
}

/// The line under the CTA. Falls back to the plain legal sentence whenever
/// there is no trial to describe — including when the offerings never loaded
/// and there is no [plan] at all, which is the store-closed face: the sheet
/// still owes the user its terms even with nothing to sell.
String planLegalLine({
  required Package? plan,
  required ({bool trial, int days}) offer,
  required String locale,
  required DateTime now,
}) {
  if (!offer.trial || plan == null) return tr('paywall.legal');
  final starts = DateFormat.MMMd(
    locale,
  ).format(now.add(Duration(days: offer.days)));
  return tr(
    plan.packageType == PackageType.annual
        ? 'paywall.trialLegalAnnual'
        : 'paywall.trialLegalMonthly',
    namedArgs: {
      'days': '${offer.days}',
      'price': plan.storeProduct.priceString,
      'date': starts,
    },
  );
}
