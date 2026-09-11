// The one place the buy button's label, its chip, the renewal line and the
// bun's line are decided — and the reason they cannot disagree. These cases
// used to be reachable only by pumping the whole screen.
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/paywall/logic/plan_offer.dart';
import 'package:kallo_mobile/services/billing/entitlement_state.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

import '../../l10n_test_loader.dart';
import 'paywall_test_support.dart';

const _eligible = {'kallo_premium_annual', 'kallo_premium_monthly'};
final _now = DateTime(2026, 9, 6);

PaywallOffer offerFor(
  List<Package> packages, {
  bool? yearlyPicked,
  TrialState trial = TrialState.none,
  Set<String> eligible = _eligible,
}) => paywallOffer(
  packages: packages,
  yearlyPicked: yearlyPicked,
  trial: trial,
  trialEligibleProductIds: eligible,
  locale: 'en',
  now: _now,
);

void main() {
  setUpTranslations();

  test('it starts on the yearly plan and offers the toggle both periods', () {
    final offer = offerFor(const [
      monthlyPackage,
      lifetimePackage,
      annualPackage,
    ]);

    expect(offer.yearly, isTrue);
    expect(offer.plan, annualPackage);
    // Lifetime is not a period — it must not make the toggle think there is a
    // third choice, nor become what the button buys.
    expect(offer.showPeriodToggle, isTrue);
  });

  test('the promise is one answer: trial label, trial date, no bare price', () {
    final offer = offerFor(const [annualPackage, monthlyPackage]);

    expect(offer.ctaLabel, tr('paywall.startTrialDays', namedArgs: {'days': '7'}));
    // The billed amount leads; the derived per-month figure follows it in
    // brackets. The other way round is what Apple cited against Cal AI.
    expect(offer.renewalLine, contains(r'$24.99/year'));
    expect(offer.renewalLine, contains(r'(≈$2.08/mo)'));
    expect(offer.renewalLine, contains('Sep 13'));
  });

  test('a customer the store would refuse gets no trial in EITHER half', () {
    final offer = offerFor(
      const [annualPackage, monthlyPackage],
      eligible: const {},
    );

    expect(offer.ctaLabel, tr('paywall.purchase'));
    // The label and the line are derived together, so a button that promises
    // nothing cannot sit over a line that names a trial start date.
    expect(offer.renewalLine, isNot(contains('Sep 13')));
    expect(offer.renewalLine, contains('until cancelled'));
  });

  test('the monthly half names its price and drops the gold and the chip', () {
    final offer = offerFor(
      const [annualPackage, monthlyPackage],
      yearlyPicked: false,
    );

    expect(offer.yearly, isFalse);
    expect(offer.plan, monthlyPackage);
    expect(
      offer.ctaLabel,
      tr('paywall.startMonthly', namedArgs: {'price': r'$9.99'}),
    );
    expect(offer.chipLabel, isNull, reason: 'the deal is the yearly plan');
    expect(offer.renewalLine, isNot(contains('/year')));
  });

  test('a single-period offering still buys, and hides the toggle', () {
    final monthlyOnly = offerFor(const [monthlyPackage]);
    expect(monthlyOnly.showPeriodToggle, isFalse);
    expect(monthlyOnly.plan, monthlyPackage);
    expect(monthlyOnly.yearly, isFalse);
    // No monthly price to measure against, so nothing is boasted.
    expect(monthlyOnly.chipLabel, isNull);

    // And the picked period falling through to the other one: yearly is asked
    // for, only monthly is on offer.
    final forced = offerFor(const [monthlyPackage], yearlyPicked: true);
    expect(forced.plan, monthlyPackage);
  });

  test('with nothing on offer the face keeps its shape and says nothing', () {
    final offer = offerFor(const []);

    expect(offer.plan, isNull);
    // No purchase to disclose terms for; the consent sentence under the band
    // still names the Terms, the Privacy Policy and the auto-renewal.
    expect(offer.renewalLine, isEmpty);
    expect(offer.chipLabel, isNull);
    // The store-closed face is the ORDINARY screen with a dead button, so it
    // keeps the toggle rather than silently dropping a control out of it —
    // showing the yearly default it would show if the store were open.
    expect(offer.showPeriodToggle, isTrue);
    expect(offer.yearly, isTrue);
  });

  test('a running trial makes the bun count it down instead of boasting', () {
    final counting = offerFor(
      const [annualPackage, monthlyPackage],
      trial: const TrialState(active: true, endsAt: null, daysRemaining: 3),
    );
    expect(
      counting.guideLine,
      tr('paywall.trialCountdown', namedArgs: {'days': '3'}),
    );
    // Mid-trial there is no second trial to start.
    expect(counting.ctaLabel, tr('paywall.purchaseTrial'));

    final lastDay = offerFor(
      const [annualPackage, monthlyPackage],
      trial: const TrialState(active: true, endsAt: null, daysRemaining: 1),
    );
    expect(lastDay.guideLine, tr('paywall.trialCountdownLastDay'));
  });

  test('the saving is boasted once, in the chip and in the bun, or not at all',
      () {
    // $9.99 x 12 = $119.88 against the $24.99 the yearly plan asks.
    final both = offerFor(const [annualPackage, monthlyPackage]);
    expect(both.savePercent, 80);
    expect(
      both.chipLabel,
      tr('paywall.saveChip', namedArgs: {'percent': '80'}),
    );
    expect(
      both.guideLine,
      tr('paywall.guideSavings', namedArgs: {'percent': '80'}),
    );

    // Nothing to compare against: the chip goes, and the bun says the other
    // thing rather than a saving it cannot compute.
    final annualOnly = offerFor(const [annualPackage]);
    expect(annualOnly.savePercent, isNull);
    expect(annualOnly.chipLabel, isNull);
    expect(annualOnly.guideLine, tr('paywall.guideUnlock'));
  });
}
