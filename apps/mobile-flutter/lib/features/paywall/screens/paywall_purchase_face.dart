import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

import '../../../services/billing/entitlement_state.dart';
import '../../../shared/widgets/panes/narrative_panes.dart';
import '../../../shell/window/keep_clear.dart';
import '../../../shell/window/window_layout.dart';
import '../../../shell/window/window_regions.dart';
import '../../../theme/kallo_theme.dart';
import '../../onboarding/widgets/start/start_hero.dart';
import '../data/paywall_controller.dart';
import '../logic/paywall_result.dart';
import '../logic/plan_offer.dart';
import '../logic/plan_pricing.dart';
import '../widgets/paywall_gutter.dart';
import '../widgets/paywall_split.dart';
import '../widgets/paywall_top_inset.dart';
import '../widgets/pitch/paywall_guide.dart';
import '../widgets/pitch/paywall_pitch.dart';
import '../widgets/plans/paywall_buy_band.dart';
import '../widgets/plans/plan_toggle.dart';

/// The face a free or lapsed user sees: the bun's one line, the title, the
/// monthly/yearly toggle, the Free ↔ Pro table, and the pinned buy band.
///
/// It sits beside [PaywallScreen], not in `widgets/`: it assembles both.
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
    required this.header,
    required this.onStayFree,
    this.storeUnavailable = false,
    this.onboarding = false,
    super.key,
  });

  final EntitlementState entitlement;
  final PaywallState state;
  final VoidCallback onStayFree;

  /// The close glyph and the wordmark: pinned over the pitch where the
  /// window has the height, scrolled with it where it does not.
  final Widget header;

  /// The screen could not even read the entitlement, so nothing here can be
  /// bought. Same face, dead button — see [_storeClosed].
  final bool storeUnavailable;

  /// The last step of onboarding. With complimentary Premium already running,
  /// the band leads with starting it rather than buying (see [PaywallWelcome]).
  final bool onboarding;

  @override
  ConsumerState<PaywallPurchaseFace> createState() =>
      _PaywallPurchaseFaceState();
}

class _PaywallPurchaseFaceState extends ConsumerState<PaywallPurchaseFace> {
  /// Keyed, the pitch keeps its scroll as a fold or a rotation moves it.
  final _pitchKey = GlobalKey();
  final _pitchController = ScrollController();

  @override
  void dispose() {
    _pitchController.dispose();
    super.dispose();
  }

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
      trialEligibleProductIds: widget.state.trialEligibleProductIds,
      locale: context.locale.toString(),
      now: ref.read(paywallClockProvider)(),
    );
    final purchasing = widget.state.phase == PaywallPhase.purchasing;
    final plan = offer.plan;
    final layout = WindowLayout.of(context);
    final split = PaywallSplit.fits(layout);
    final toggle = offer.showPeriodToggle ? _toggle(offer, purchasing) : null;
    final band = PaywallBuyBand(
      opaque: !split && !layout.twoPane,
      offer: offer,
      loading: purchasing,
      onBuy:
          purchasing || _storeClosed || plan == null
              ? null
              : () => _purchase(plan),
      onStayFree: widget.onStayFree,
      welcome: _welcome(context),
      head: split ? _decisionHead(toggle) : null,
    );
    final pitch = PaywallPitch(
      key: _pitchKey,
      controller: _pitchController,
      header: layout.compactHeight && !split ? widget.header : null,
      guideLine: split ? null : offer.guideLine,
      toggle: split ? null : toggle,
    );
    if (split) {
      return PaywallSplit(header: widget.header, table: pitch, decision: band);
    }
    // One gutter for the column, header and band included. `near` is the
    // pane beside a fold, or the safe width without one. A page that takes
    // the control column's width can be wider than the table's 420pt cap;
    // there the gutter grows to meet the table, so they keep one edge.
    final near = WindowRegions(layout).near.width;
    final column = PaywallGutter(
      value:
          layout.columnFree
              ? math.max(PaywallGutter.forWidth(near), (near - 420) / 2)
              : PaywallGutter.forWidth(near),
      child: PaywallTopInset(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (!layout.compactHeight) widget.header,
            Expanded(child: pitch),
            band,
          ],
        ),
      ),
    );
    // Beside the fold the paywall is the last screen of the signed-out flow
    // and wears its far pane: the start preview. The near pane is the phone's
    // column, header included.
    return NarrativePanes(far: const StartHero(), near: column, single: column);
  }

  PaywallWelcome? _welcome(BuildContext context) {
    final entitlement = widget.entitlement;
    final until = entitlement.expiresAt;
    if (!widget.onboarding || !entitlement.complimentary || until == null) {
      return null;
    }
    final now = ref.read(paywallClockProvider)();
    final days = (until.difference(now).inHours / 24).ceil();
    if (days <= 0) return null;
    return PaywallWelcome(
      days: days,
      until: DateFormat.MMMd(context.locale.toString()).format(until.toLocal()),
    );
  }

  /// Beside the table the decision carries the title and the toggle over
  /// the button they belong to. The bun's line is left to the taller
  /// windows: these are all short.
  Widget _decisionHead(Widget? toggle) => Column(
    mainAxisSize: MainAxisSize.min,
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      PaywallGuide.title(),
      if (toggle != null) ...[
        const SizedBox(height: KalloSpacing.sp3_5),
        // Beside the table there is height to spare: the toggle moves down
        // out of the status items' corner rather than narrowing.
        KeepClear(mode: KeepClearMode.below, child: toggle),
      ],
    ],
  );

  Widget _toggle(PaywallOffer offer, bool purchasing) => PlanToggle(
    monthlyLabel: tr('paywall.toggleMonthly'),
    yearlyLabel: tr('paywall.toggleYearly'),
    yearly: offer.yearly,
    onChanged:
        purchasing || offer.plan == null
            ? null
            : (value) => setState(() => _yearly = value),
  );

  Future<void> _purchase(Package plan) =>
      _run(() => ref.read(paywallControllerProvider.notifier).purchase(plan));

  Future<void> _run(Future<PaywallActionResult> Function() action) async {
    final result = await action();
    if (mounted) handlePaywallResult(context, result);
  }
}
