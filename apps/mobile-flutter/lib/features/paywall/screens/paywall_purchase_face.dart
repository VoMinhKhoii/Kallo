import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:purchases_flutter/purchases_flutter.dart';
import '../../../shell/window/window_layout.dart';
import '../../../shared/widgets/panes/narrative_panes.dart';
import '../../../shell/window/window_regions.dart';

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
    this.onboarding = false,
    super.key,
    this.scrollingHeader,
  });

  final EntitlementState entitlement;
  final Widget? scrollingHeader;
  final PaywallState state;
  final VoidCallback onStayFree;

  /// The screen could not even read the entitlement, so nothing here can be
  /// bought. Same face, dead button — see [_storeClosed].
  final bool storeUnavailable;

  /// The last step of onboarding. With complimentary Premium already running,
  /// the band leads with starting it rather than buying (see [PaywallWelcome]).
  final bool onboarding;

  /// The design's 20, not the screen's header inset: the table's two columns
  /// are what set this width, and at 24 the Vietnamese labels wrap a row
  /// early.
  static const double gutter = KalloSpacing.sp5;

  @override
  ConsumerState<PaywallPurchaseFace> createState() =>
      _PaywallPurchaseFaceState();
}

class _PaywallPurchaseFaceState extends ConsumerState<PaywallPurchaseFace> {
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

  bool get _twoPane => WindowLayout.of(context).twoPane;

  bool get _tableAtNaturalHeight =>
      WindowLayout.of(context).foldAcross &&
      MediaQuery.textScalerOf(context).scale(16) > 16;

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
    final regions = WindowRegions(layout);
    final band = PaywallBuyBand(
      opaque: !layout.twoPane,
      offer: offer,
      loading: purchasing,
      onBuy:
          purchasing || _storeClosed || plan == null
              ? null
              : () => _purchase(plan),
      onStayFree: widget.onStayFree,
      welcome: _welcome(context),
      toggle:
          layout.twoPane && offer.showPeriodToggle
              ? _toggle(offer, purchasing)
              : null,
    );
    final pitch = _pitch(offer, purchasing);
    return Stack(
      children: [
        NarrativePanes(
          far: pitch,
          near: const SizedBox.shrink(),
          single: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [Expanded(child: pitch), band],
          ),
        ),
        // Beside the fold the band runs from the near pane out to the screen
        // edge on the controls' side, past the pane's safe area, so it is
        // placed here rather than as the near pane.
        if (layout.twoPane)
          Positioned(
            left: layout.nearLeft ? 0 : regions.near.left,
            right:
                layout.controlEdge == ControlEdge.right
                    ? 0
                    : layout.size.width - regions.near.right,
            top: 0,
            bottom: 0,
            child: Align(alignment: Alignment.bottomCenter, child: band),
          ),
      ],
    );
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

  /// Scrolls, and only this half does: with the system text size turned up
  /// the table outgrows any phone, and it is the half a user can afford to go
  /// looking for (see [PaywallBuyBand]).
  ///
  /// On a tall phone the table would stop short of the buy band and leave a
  /// void under it, so the table takes whatever height is left instead
  /// ([SliverFillRemaining]) and spreads its rows to fill it. When the
  /// content is taller than the screen, it simply scrolls as before.
  Widget _pitch(PaywallOffer offer, bool purchasing) => LayoutBuilder(
    builder:
        (context, bounds) => CustomScrollView(
          key: _pitchKey,
          controller: _pitchController,
          slivers: [
            if (widget.scrollingHeader != null)
              SliverToBoxAdapter(child: widget.scrollingHeader),
            // The padding goes INSIDE the fill, not around it as a SliverPadding:
            // SliverFillRemaining fills whatever is left of the viewport, so a
            // SliverPadding's bottom inset landed below the fold — the card ran
            // flush into the buy band and the page scrolled by that inset.
            _pitchSliver(
              Padding(
                padding: EdgeInsets.fromLTRB(
                  PaywallPurchaseFace.gutter +
                      (_twoPane ? 0 : MediaQuery.viewPaddingOf(context).left),
                  KalloSpacing.sp2,
                  PaywallPurchaseFace.gutter +
                      (_twoPane ? 0 : MediaQuery.viewPaddingOf(context).right),
                  KalloSpacing.sp4 +
                      (_twoPane ? MediaQuery.viewPaddingOf(context).bottom : 0),
                ),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 420),
                    child: _pitchColumn(
                      offer,
                      purchasing,
                      math.min(
                        420,
                        bounds.maxWidth -
                            2 * PaywallPurchaseFace.gutter -
                            (_twoPane
                                ? 0
                                : MediaQuery.viewPaddingOf(context).horizontal),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
  );

  Widget _pitchSliver(Widget child) =>
      _tableAtNaturalHeight
          ? SliverToBoxAdapter(child: child)
          : SliverFillRemaining(hasScrollBody: false, child: child);

  Widget _pitchColumn(PaywallOffer offer, bool purchasing, double tableWidth) =>
      Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PaywallGuide(line: offer.guideLine),
          const SizedBox(height: KalloSpacing.sp3_5),
          if (offer.showPeriodToggle && !_twoPane) ...[
            _toggle(offer, purchasing),
            const SizedBox(height: KalloSpacing.sp2_5),
          ],
          // Large text needs the table's natural height in the bounded column;
          // a flex allocation can be shorter than its wrapped rows.
          if (_tableAtNaturalHeight)
            PlanComparison(availableWidth: tableWidth)
          else
            Expanded(child: PlanComparison(availableWidth: tableWidth)),
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
