/// What the paywall's decision half is offering right now — resolved ONCE,
/// as data, from the packages the store returned and the period the user has
/// picked.
///
/// This is the seam the screen used to lack. The button's label, its savings
/// chip, the renewal line under it and the bun's opening line are four halves
/// of one promise: a button reading "Start 7-day trial" over a line that names
/// no trial, or a chip boasting a saving computed against a price in another
/// currency, are the bugs that come from deriving them separately. They are
/// derived together here, so they cannot disagree — and because this is a pure
/// function, the cases that used to need a pumped widget (a single-period
/// offering, a trial-ineligible customer, two currencies, no annual plan) are
/// three-line unit tests.
///
/// **Apple, April 2026.** Cal AI — this app's closest analogue — was pulled
/// for, among other things, showing a derived per-month figure more
/// prominently than the amount actually billed, with the renewal terms behind
/// a toggle. So [PaywallOffer.renewalLine] leads with the amount charged and
/// carries the per-month figure in brackets after it, and the screen never
/// hides it.
library;

import 'package:easy_localization/easy_localization.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

import '../../../services/billing/entitlement_state.dart';
import 'plan_pricing.dart';

/// Everything the decision half renders, in one value.
class PaywallOffer {
  const PaywallOffer({
    required this.plan,
    required this.yearly,
    required this.showPeriodToggle,
    required this.ctaLabel,
    required this.renewalLine,
    required this.guideLine,
    this.chipLabel,
    this.savePercent,
  });

  /// What the button buys — null only when the offering never arrived, which
  /// is the store-closed face: same screen, dead button.
  final Package? plan;

  /// The yearly plan is the one selected, so the buy button wears the gold.
  /// Gold marks the DEAL, not the tap.
  final bool yearly;

  /// Whether to draw the period toggle at all.
  ///
  /// True when both periods are on offer — and ALSO when the offering is
  /// empty, which is the store-closed face: that face is meant to be the
  /// ordinary screen with a dead button (`docs/BILLING.md`), and silently
  /// dropping a whole control out of it read as the toggle having been lost.
  /// It is inert there, like everything else on that face.
  ///
  /// False only when the store really does offer ONE period: a segmented
  /// control with one live half is a label wearing a control's chrome, and a
  /// yearly half that cannot be picked is a lie about what is for sale.
  final bool showPeriodToggle;

  final String ctaLabel;
  final String renewalLine;

  /// The bun's one line: how much the yearly plan saves, or — while a trial
  /// is running — how much of it is left, which is the more useful fact at
  /// that moment.
  final String guideLine;

  /// "Save 40%", on the yearly button only. Null when the saving cannot be
  /// computed against a monthly price in the same currency: a boast we cannot
  /// back is not made.
  final String? chipLabel;

  final int? savePercent;
}

/// Resolves the offer. [yearlyPicked] is null until the user touches the
/// toggle, which is what lets the default follow whatever the offering
/// actually carries rather than being decided before the packages land.
PaywallOffer paywallOffer({
  required List<Package> packages,
  required bool? yearlyPicked,
  required TrialState trial,
  required Set<String> trialEligibleProductIds,
  required String locale,
  required DateTime now,
}) {
  final split = splitPlans(packages);
  // Default to the yearly plan: it is the deal, and it is what the toggle
  // shows selected. With NO packages at all there is no annual to point at,
  // but the inert toggle still has to show something — and showing the
  // monthly half selected would preview the wrong default.
  final yearly =
      yearlyPicked ?? (split.annual != null || split.monthly == null);
  // Falls back to the other period when the picked one is not on offer, so a
  // single-plan offering still buys something.
  final plan = yearly
      ? split.annual ?? split.monthly
      : split.monthly ?? split.annual;
  final pricing = split.annual == null
      ? null
      : yearlyPricing(annual: split.annual!, monthly: split.monthly);
  final offer = plan == null
      ? (trial: false, days: 0)
      : trialOffer(
          plan: plan,
          trialActive: trial.active,
          eligibleProductIds: trialEligibleProductIds,
        );
  final savePercent = pricing?.savePercent;
  return PaywallOffer(
    plan: plan,
    yearly: yearly,
    showPeriodToggle:
        (split.annual != null && split.monthly != null) || packages.isEmpty,
    ctaLabel: _ctaLabel(plan: plan, offer: offer, trialActive: trial.active),
    renewalLine: _renewalLine(
      plan: plan,
      perMonth: pricing?.perMonth,
      offer: offer,
      locale: locale,
      now: now,
    ),
    guideLine: _guideLine(trial: trial, savePercent: savePercent),
    chipLabel: yearly && savePercent != null
        ? tr('paywall.saveChip', namedArgs: {'percent': '$savePercent'})
        : null,
    savePercent: savePercent,
  );
}

/// "Start {n}-day trial" only when there IS one to start. Otherwise the
/// monthly plan names its own price on the button — it has no trial and no
/// saving to lead with, so the price is the most useful thing there — and the
/// yearly plan without a trial falls back to the plain "Start Premium".
String _ctaLabel({
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

/// What will be charged, when it starts, and that it repeats until cancelled.
///
/// EMPTY with no [plan] at all. There is then no purchase to disclose terms
/// for, and the consent sentence below the band already names the Terms, the
/// Privacy Policy and the auto-renewal — so the long legal paragraph that used
/// to stand in here was three lines of Vietnamese fine print restating, under
/// a dead button, something the line beneath it said again.
String _renewalLine({
  required Package? plan,
  required String? perMonth,
  required ({bool trial, int days}) offer,
  required String locale,
  required DateTime now,
}) {
  if (plan == null) return '';
  final price = plan.storeProduct.priceString;
  // Only a trial defers the first charge. Without one the subscription starts
  // now, and naming a date would be an invented grace period.
  final starts = offer.trial
      ? DateFormat.MMMd(locale).format(now.add(Duration(days: offer.days)))
      : null;
  if (plan.packageType == PackageType.annual && perMonth != null) {
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

String _guideLine({required TrialState trial, required int? savePercent}) {
  if (trial.active) {
    return trial.daysRemaining <= 1
        ? tr('paywall.trialCountdownLastDay')
        : tr(
            'paywall.trialCountdown',
            namedArgs: {'days': '${trial.daysRemaining}'},
          );
  }
  if (savePercent == null) return tr('paywall.guideUnlock');
  return tr('paywall.guideSavings', namedArgs: {'percent': '$savePercent'});
}
