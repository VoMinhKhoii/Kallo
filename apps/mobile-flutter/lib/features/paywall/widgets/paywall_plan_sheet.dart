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
import '../logic/plan_promise.dart';
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
    this.storeUnavailable = false,
    super.key,
  });

  final EntitlementState entitlement;
  final PaywallState state;

  /// The screen could not even read the entitlement, so nothing here can be
  /// bought. Same face, dead CTA — see [_storeClosed].
  final bool storeUnavailable;

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

  /// Purchases switched off, offerings never loaded, or the entitlement
  /// unreadable. None of it is the user's to fix and none of it makes the
  /// pitch above untrue, so the sheet keeps its ordinary shape and the CTA
  /// alone goes dead — no error copy, no retry, no empty state.
  bool get _storeClosed =>
      widget.storeUnavailable ||
      widget.state.phase == PaywallPhase.unavailable ||
      widget.state.phase == PaywallPhase.loadError;

  Widget _body(List<Package> plans) {
    switch (widget.state.phase) {
      case PaywallPhase.loading:
        return const PaywallCenteredNote(child: PaywallSpinner());
      // The mid-purchase phases keep their notes: money is in flight and the
      // user is owed a word about it — not the same as a store that never
      // opened.
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
      case PaywallPhase.unavailable:
      case PaywallPhase.loadError:
      case PaywallPhase.ready:
      case PaywallPhase.purchasing:
        return _plans(plans);
    }
  }

  Widget _plans(List<Package> plans) {
    // Null only when the offerings never arrived: the sheet is then the same
    // anatomy minus the rows, not a different screen.
    final selected = plans.isEmpty ? null : _resolveSelection(plans);
    final offer = selected == null
        ? (trial: false, days: 0)
        : trialOffer(
            plan: selected,
            trialActive: widget.entitlement.trial.active,
            eligibleProductIds: widget.state.trialEligibleProductIds,
          );
    final monthly = splitPlans(plans).monthly;
    final purchasing = widget.state.phase == PaywallPhase.purchasing;
    final disabled = selected == null || _storeClosed;
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
            selected: plan.identifier == selected!.identifier,
            // Still selectable with the store closed: the rows are the pitch
            // as much as the picker, and only the CTA is meant to go dead.
            enabled: !purchasing,
            onTap: () => setState(() => _selectedId = plan.identifier),
          ),
          if (plan != plans.last) const SizedBox(height: KalloSpacing.sp3),
        ],
        if (plans.isNotEmpty) const SizedBox(height: KalloSpacing.sp4),
        Text(
          planLegalLine(
            plan: selected,
            offer: offer,
            locale: context.locale.toString(),
            now: ref.read(paywallClockProvider)(),
          ),
          style: dashMeta().copyWith(height: 1.4),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: KalloSpacing.sp3),
        KalloButton(
          title: planCtaLabel(
            offer: offer,
            trialActive: widget.entitlement.trial.active,
          ),
          variant: KalloButtonVariant.cta,
          loading: purchasing,
          disabled: disabled,
          onPressed: purchasing || disabled ? null : () => _purchase(selected),
        ),
        const SizedBox(height: KalloSpacing.sp1),
        PaywallSheetActions(state: widget.state),
      ],
    );
  }

  /// The picked plan, or the default when nothing is picked yet — or when the
  /// pick is no longer in the offering.
  Package _resolveSelection(List<Package> plans) {
    for (final plan in plans) {
      if (plan.identifier == _selectedId) return plan;
    }
    return defaultPlan(plans)!;
  }

  Future<void> _purchase(Package plan) => _run(
        () => ref.read(paywallControllerProvider.notifier).purchase(plan),
      );

  Future<void> _run(Future<PaywallActionResult> Function() action) async {
    final result = await action();
    if (mounted) handlePaywallResult(context, result);
  }
}
