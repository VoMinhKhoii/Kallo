import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

import '../../../data/billing/entitlements_provider.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../paywall_controller.dart';
import '../paywall_result.dart';
import 'package_card.dart';
import 'paywall_status.dart';

/// Renders the current offering state and the restore action.
class PaywallPackageSection extends ConsumerWidget {
  const PaywallPackageSection({
    required this.entitlement,
    required this.state,
    super.key,
  });

  final EntitlementState entitlement;
  final PaywallState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _PackageState(entitlement: entitlement, state: state),
        const SizedBox(height: NhamSpacing.sp4),
        _RestoreRow(state: state),
      ],
    );
  }
}

class _PackageState extends ConsumerWidget {
  const _PackageState({required this.entitlement, required this.state});

  final EntitlementState entitlement;
  final PaywallState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    switch (state.phase) {
      case PaywallPhase.loading:
        return const PaywallCenteredNote(child: PaywallSpinner());
      case PaywallPhase.unavailable:
        return PaywallNote(
          title: tr('paywall.unavailableTitle'),
          body: tr('paywall.unavailableBody'),
        );
      case PaywallPhase.loadError:
        return PaywallRetryNote(
          message: tr('paywall.loadError'),
          onRetry:
              () =>
                  ref.read(paywallControllerProvider.notifier).loadOfferings(),
        );
      case PaywallPhase.verifying:
        return PaywallNote(
          title: tr('paywall.verifying'),
          body: tr('paywall.verifyPending'),
          leading: const PaywallSpinner(),
        );
      case PaywallPhase.activationPending:
        return PaywallRetryNote(
          message: tr('paywall.verifyPending'),
          onRetry: () => _retryActivation(context, ref),
        );
      case PaywallPhase.ready:
      case PaywallPhase.purchasing:
        return _PackageList(entitlement: entitlement, state: state);
    }
  }

  Future<void> _retryActivation(BuildContext context, WidgetRef ref) async {
    final result =
        await ref.read(paywallControllerProvider.notifier).retryActivation();
    if (context.mounted) handlePaywallResult(context, result);
  }
}

class _PackageList extends ConsumerWidget {
  const _PackageList({required this.entitlement, required this.state});

  final EntitlementState entitlement;
  final PaywallState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (state.packages.isEmpty) {
      return PaywallRetryNote(
        message: tr('paywall.loadError'),
        onRetry:
            () => ref.read(paywallControllerProvider.notifier).loadOfferings(),
      );
    }
    final purchasing = state.phase == PaywallPhase.purchasing;
    final ctaKey =
        entitlement.trial.active ? 'paywall.purchaseTrial' : 'paywall.purchase';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final package in state.packages) ...[
          PackageCard(
            package: package,
            ctaLabel: tr(ctaKey),
            busy: state.busyPackageId == package.identifier,
            enabled: !purchasing,
            onTap: () => _purchase(context, ref, package),
          ),
          const SizedBox(height: NhamSpacing.sp3),
        ],
      ],
    );
  }

  Future<void> _purchase(
    BuildContext context,
    WidgetRef ref,
    Package package,
  ) async {
    final result = await ref
        .read(paywallControllerProvider.notifier)
        .purchase(package);
    if (context.mounted) handlePaywallResult(context, result);
  }
}

class _RestoreRow extends ConsumerWidget {
  const _RestoreRow({required this.state});

  final PaywallState state;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final busy =
        state.phase == PaywallPhase.purchasing ||
        state.phase == PaywallPhase.verifying;
    return Center(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap:
            busy
                ? null
                : () async {
                  HapticFeedback.lightImpact();
                  final result =
                      await ref
                          .read(paywallControllerProvider.notifier)
                          .restore();
                  if (context.mounted) handlePaywallResult(context, result);
                },
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: NhamSpacing.sp2),
          child: Text(
            tr('paywall.restore'),
            style: dashBody(
              weight: FontWeight.w500,
              color: busy ? kInkMuted : NhamColors.text,
            ),
          ),
        ),
      ),
    );
  }
}
