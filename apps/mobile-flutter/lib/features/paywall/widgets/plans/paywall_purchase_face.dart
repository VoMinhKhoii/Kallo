import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

import '../../../../services/billing/entitlement_state.dart';
import '../../../../theme/kallo_theme.dart';
import '../../data/paywall_controller.dart';
import '../../logic/paywall_result.dart';
import '../../logic/plan_pricing.dart';
import '../../logic/plan_promise.dart';
import '../pitch/paywall_guide.dart';
import '../pitch/plan_comparison.dart';
import 'paywall_buy_band.dart';
import 'plan_toggle.dart';

/// The face a free or lapsed user sees: the bun's one line, the title, the
/// monthly/yearly toggle, the Free ↔ Pro table, and the pinned buy band.
///
/// **The selection lives here, not in [PaywallState].** The choice belongs to
/// this screen's session, not to a purchase machine that rebuilds on every
/// account change. It is a BOOL rather than a package id: with exactly two
/// plans the question is which period, and a period cannot go stale when the
/// offering reloads the way a stored identifier can.
class PaywallPurchaseFace extends ConsumerStatefulWidget {
  const PaywallPurchaseFace({
    required this.entitlement,
    required this.state,
    required this.onStayFree,
    this.storeUnavailable = false,
    super.key,
  });

  final EntitlementState entitlement;
  final PaywallState state;
  final VoidCallback onStayFree;

  /// The screen could not even read the entitlement, so nothing here can be
  /// bought. Same face, dead button — see [_storeClosed].
  final bool storeUnavailable;

  /// The design's 20, not the screen's header inset: the table's two columns
  /// are what set this width, and at 24 the Vietnamese labels wrap a row
  /// early.
  static const double gutter = KalloSpacing.sp5;

  @override
  ConsumerState<PaywallPurchaseFace> createState() => _PaywallPurchaseFaceState();
}

class _PaywallPurchaseFaceState extends ConsumerState<PaywallPurchaseFace> {
  /// Null until the user touches the toggle, so the default follows whatever
  /// the offering actually carries rather than being decided in `initState`
  /// off packages that may not have arrived yet.
  bool? _yearly;

  /// Purchases switched off, offerings never loaded, or the entitlement
  /// unreadable. None of it is the user's to fix and none of it makes the
  /// table untrue, so the screen keeps its shape and the buy button alone
  /// goes dead — no error copy, no retry, no empty state.
  bool get _storeClosed =>
      widget.storeUnavailable ||
      widget.state.phase == PaywallPhase.unavailable ||
      widget.state.phase == PaywallPhase.loadError;

  @override
  Widget build(BuildContext context) {
    final split = splitPlans(widget.state.packages);
    final yearly = _yearly ?? split.annual != null;
    // Falls back to the other period when the chosen one is not on offer, so
    // a single-plan offering still buys something.
    final selected = yearly
        ? split.annual ?? split.monthly
        : split.monthly ?? split.annual;
    final pricing = split.annual == null
        ? null
        : yearlyPricing(annual: split.annual!, monthly: split.monthly);
    final offer = selected == null
        ? (trial: false, days: 0)
        : trialOffer(
            plan: selected,
            trialActive: widget.entitlement.trial.active,
            eligibleProductIds: widget.state.trialEligibleProductIds,
          );
    final purchasing = widget.state.phase == PaywallPhase.purchasing;
    final disabled = selected == null || _storeClosed;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(child: _pitch(split, yearly, pricing?.savePercent, purchasing)),
        PaywallBuyBand(
          state: widget.state,
          label: planCtaLabel(
            plan: selected,
            offer: offer,
            trialActive: widget.entitlement.trial.active,
          ),
          chipLabel: _chip(yearly, pricing?.savePercent),
          renewalLine: planRenewalLine(
            plan: selected,
            perMonth: pricing?.perMonth,
            offer: offer,
            locale: context.locale.toString(),
            now: ref.read(paywallClockProvider)(),
          ),
          yearly: yearly,
          loading: purchasing,
          disabled: disabled,
          onBuy: purchasing || disabled ? null : () => _purchase(selected),
          onStayFree: widget.onStayFree,
        ),
      ],
    );
  }

  /// Scrolls, and only this half does: with the system text size turned up
  /// the table outgrows any phone, and it is the half a user can afford to go
  /// looking for (see [PaywallBuyBand]).
  Widget _pitch(
    ({Package? annual, Package? monthly}) split,
    bool yearly,
    int? savePercent,
    bool purchasing,
  ) => SingleChildScrollView(
    padding: const EdgeInsets.fromLTRB(
      PaywallPurchaseFace.gutter,
      KalloSpacing.sp2,
      PaywallPurchaseFace.gutter,
      KalloSpacing.sp4,
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        PaywallGuide(
          trial: widget.entitlement.trial,
          savePercent: savePercent,
        ),
        const SizedBox(height: KalloSpacing.sp3_5),
        // Hidden when there is nothing to choose between — a segmented
        // control with one live half is a label wearing a control's chrome.
        if (split.annual != null && split.monthly != null) ...[
          PlanToggle(
            monthlyLabel: tr('paywall.toggleMonthly'),
            yearlyLabel: tr('paywall.toggleYearly'),
            yearly: yearly,
            onChanged: purchasing
                ? null
                : (value) => setState(() => _yearly = value),
          ),
          const SizedBox(height: KalloSpacing.sp2_5),
        ],
        const PlanComparison(),
      ],
    ),
  );

  /// The savings pill on the buy button — yearly only, and only when the
  /// saving can actually be computed against a monthly price in the same
  /// currency. A boast we cannot back is not made.
  String? _chip(bool yearly, int? savePercent) =>
      yearly && savePercent != null
      ? tr('paywall.saveChip', namedArgs: {'percent': '$savePercent'})
      : null;

  Future<void> _purchase(Package plan) => _run(
    () => ref.read(paywallControllerProvider.notifier).purchase(plan),
  );

  Future<void> _run(Future<PaywallActionResult> Function() action) async {
    final result = await action();
    if (mounted) handlePaywallResult(context, result);
  }
}
