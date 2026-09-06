import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

import '../../../services/billing/entitlement_state.dart';
import '../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_theme.dart';
import '../data/paywall_controller.dart';
import '../logic/paywall_result.dart';
import '../logic/plan_pricing.dart';
import 'paywall_sheet_actions.dart';
import 'paywall_status.dart';
import 'plan_row.dart';

/// The white sheet the Kallo Pro band sits above: the two plans, the legal
/// line, the single CTA, and the restore/terms/privacy row.
///
/// **The selection lives here, not in [PaywallState].** The choice belongs to
/// this sheet's session, not to a purchase machine that rebuilds on every
/// account change. The default is resolved at build time from the packages on
/// hand ([defaultPlan]), so a plan arriving late never leaves it pointing at
/// nothing.
class PaywallPlanSheet extends ConsumerStatefulWidget {
  const PaywallPlanSheet({
    required this.entitlement,
    required this.state,
    super.key,
  });

  final EntitlementState entitlement;
  final PaywallState state;

  /// 28, not [KalloRadii.sheet] (22): this sheet is the whole lower half of the
  /// screen rather than a panel over content, and at 22 the corners read as a
  /// card that happens to touch the bottom edge.
  static const double radius = 28;

  @override
  ConsumerState<PaywallPlanSheet> createState() => _PaywallPlanSheetState();
}

class _PaywallPlanSheetState extends ConsumerState<PaywallPlanSheet> {
  String? _selectedId;

  @override
  Widget build(BuildContext context) {
    final plans = visiblePlans(widget.state.packages);
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        color: kCardSurface,
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(PaywallPlanSheet.radius),
        ),
        boxShadow: kSheetShadows,
      ),
      padding: EdgeInsets.fromLTRB(
        KalloSpacing.sp5,
        KalloSpacing.sp6,
        KalloSpacing.sp5,
        // sp8 PLUS the home indicator: the sheet owns the bottom edge, so the
        // inset is the device's.
        KalloSpacing.sp8 + MediaQuery.viewPaddingOf(context).bottom,
      ),
      child: _body(plans),
    );
  }

  Widget _body(List<Package> plans) {
    switch (widget.state.phase) {
      case PaywallPhase.loading:
        return const PaywallCenteredNote(child: PaywallSpinner());
      case PaywallPhase.unavailable:
        return PaywallNote(
          title: tr('paywall.unavailableTitle'),
          body: tr('paywall.unavailableBody'),
        );
      case PaywallPhase.loadError:
        return _retry();
      case PaywallPhase.verifying:
        return PaywallNote(
          title: tr('paywall.verifying'),
          body: tr('paywall.verifyPending'),
          leading: const PaywallSpinner(),
        );
      case PaywallPhase.activationPending:
        return PaywallRetryNote(
          message: tr('paywall.verifyPending'),
          onRetry: () => _run(
            () => ref.read(paywallControllerProvider.notifier).retryActivation(),
          ),
        );
      case PaywallPhase.ready:
      case PaywallPhase.purchasing:
        if (plans.isEmpty) return _retry();
        return _plans(plans);
    }
  }

  Widget _retry() => PaywallRetryNote(
        message: tr('paywall.loadError'),
        onRetry: () => ref.read(paywallControllerProvider.notifier).loadOfferings(),
      );

  Widget _plans(List<Package> plans) {
    final selected = _resolveSelection(plans);
    final monthly = splitPlans(plans).monthly;
    final offer = trialOffer(
      plan: selected,
      trialActive: widget.entitlement.trial.active,
      eligibleProductIds: widget.state.trialEligibleProductIds,
    );
    final purchasing = widget.state.phase == PaywallPhase.purchasing;
    return Column(
      // The Align above hands down LOOSE constraints — a `max` column would
      // eat them and strand the plans at the top of a half-empty sheet.
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final plan in plans) ...[
          PlanRow.forPackage(
            plan,
            monthly: monthly,
            selected: plan.identifier == selected.identifier,
            enabled: !purchasing,
            onTap: () => setState(() => _selectedId = plan.identifier),
          ),
          if (plan != plans.last) const SizedBox(height: KalloSpacing.sp3),
        ],
        const SizedBox(height: KalloSpacing.sp4),
        Text(
          _legal(selected, offer),
          style: dashMeta().copyWith(height: 1.4),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: KalloSpacing.sp3),
        KalloButton(
          title: _ctaLabel(offer),
          variant: KalloButtonVariant.cta,
          loading: purchasing,
          onPressed: purchasing ? null : () => _purchase(selected),
        ),
        const SizedBox(height: KalloSpacing.sp1),
        PaywallSheetActions(state: widget.state),
      ],
    );
  }

  /// The picked plan, or the default when nothing is picked yet — or when the
  /// pick no longer exists in the offering.
  Package _resolveSelection(List<Package> plans) {
    for (final plan in plans) {
      if (plan.identifier == _selectedId) return plan;
    }
    return defaultPlan(plans)!;
  }

  /// "Start free trial" only when there IS one to start; otherwise the
  /// pre-existing purchase / purchaseTrial pair stands.
  String _ctaLabel(({bool trial, int days}) offer) {
    if (offer.trial) return tr('paywall.startFreeTrial');
    return tr(
      widget.entitlement.trial.active
          ? 'paywall.purchaseTrial'
          : 'paywall.purchase',
    );
  }

  String _legal(Package plan, ({bool trial, int days}) offer) {
    if (!offer.trial) return tr('paywall.legal');
    final starts = DateFormat.MMMd(context.locale.toString())
        .format(ref.read(paywallClockProvider)().add(Duration(days: offer.days)));
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

  Future<void> _purchase(Package plan) => _run(
        () => ref.read(paywallControllerProvider.notifier).purchase(plan),
      );

  Future<void> _run(Future<PaywallActionResult> Function() action) async {
    final result = await action();
    if (mounted) handlePaywallResult(context, result);
  }
}
