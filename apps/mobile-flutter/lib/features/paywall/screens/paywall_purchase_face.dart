import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

import '../../../services/billing/entitlement_state.dart';
import '../../../theme/kallo_theme.dart';
import '../data/paywall_controller.dart';
import '../logic/paywall_result.dart';
import '../logic/plan_offer.dart';
import '../logic/plan_pricing.dart';
import '../widgets/pitch/paywall_guide.dart';
import '../widgets/pitch/plan_comparison.dart';
import '../widgets/plans/paywall_buy_band.dart';
import '../widgets/plans/plan_toggle.dart';

/// The face a free or lapsed user sees: the bun's one line, the title, the
/// monthly/yearly toggle, the Free ↔ Pro table, and the pinned buy band.
///
/// It lives beside [PaywallScreen] rather than under `widgets/` because it is
/// the screen's BODY, not a peer of the pieces it arranges — it reaches across
/// `pitch/` and `plans/` to assemble them, which is the layer above both.
///
/// **The selection lives here, not in [PaywallState].** The choice belongs to
/// this screen's session, not to a purchase machine that rebuilds on every
/// account change. It is a BOOL rather than a package id: with exactly two
/// periods the question is which one, and a period cannot go stale when the
/// offering reloads the way a stored identifier can.
///
/// Everything ELSE this screen shows — the label, the chip, the renewal line,
/// the bun's line, which package the button buys — is derived in one place by
/// [paywallOffer], so this widget holds state and layout and nothing more.
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
  ConsumerState<PaywallPurchaseFace> createState() =>
      _PaywallPurchaseFaceState();
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
    final offer = paywallOffer(
      packages: widget.state.packages,
      yearlyPicked: _yearly,
      trial: widget.entitlement.trial,
      trialEligibleProductIds: widget.state.trialEligibleProductIds,
      locale: context.locale.toString(),
      now: ref.read(paywallClockProvider)(),
    );
    final purchasing = widget.state.phase == PaywallPhase.purchasing;
    final plan = offer.plan;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(child: _pitch(offer, purchasing)),
        PaywallBuyBand(
          offer: offer,
          loading: purchasing,
          onBuy: purchasing || _storeClosed || plan == null
              ? null
              : () => _purchase(plan),
          onStayFree: widget.onStayFree,
        ),
      ],
    );
  }

  /// Scrolls, and only this half does: with the system text size turned up
  /// the table outgrows any phone, and it is the half a user can afford to go
  /// looking for (see [PaywallBuyBand]).
  Widget _pitch(PaywallOffer offer, bool purchasing) => SingleChildScrollView(
    padding: const EdgeInsets.fromLTRB(
      PaywallPurchaseFace.gutter,
      KalloSpacing.sp2,
      PaywallPurchaseFace.gutter,
      KalloSpacing.sp4,
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        PaywallGuide(line: offer.guideLine),
        const SizedBox(height: KalloSpacing.sp3_5),
        if (offer.showPeriodToggle) ...[
          PlanToggle(
            monthlyLabel: tr('paywall.toggleMonthly'),
            yearlyLabel: tr('paywall.toggleYearly'),
            yearly: offer.yearly,
            // Inert while a purchase is in flight, and on the store-closed
            // face, where there is no second period to switch to.
            onChanged: purchasing || offer.plan == null
                ? null
                : (value) => setState(() => _yearly = value),
          ),
          const SizedBox(height: KalloSpacing.sp2_5),
        ],
        const PlanComparison(),
      ],
    ),
  );

  Future<void> _purchase(Package plan) => _run(
    () => ref.read(paywallControllerProvider.notifier).purchase(plan),
  );

  Future<void> _run(Future<PaywallActionResult> Function() action) async {
    final result = await action();
    if (mounted) handlePaywallResult(context, result);
  }
}
