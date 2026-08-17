import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/widgets/toast/top_toast.dart';
import '../data/paywall_controller.dart';

/// Applies the shared navigation/toast behavior for purchase and restore
/// outcomes. User cancellation is intentionally silent.
void handlePaywallResult(BuildContext context, PaywallActionResult result) {
  switch (result) {
    case PaywallActionResult.unlocked:
      final router = GoRouter.of(context);
      if (router.canPop()) {
        router.pop();
      } else {
        context.go('/logging');
      }
    case PaywallActionResult.pending:
    case PaywallActionResult.paymentPending:
      showTopToast(context, tr('paywall.verifyPending'));
    case PaywallActionResult.nothingToRestore:
      showTopToast(
        context,
        tr('paywall.restoreNothing'),
        variant: TopToastVariant.error,
      );
    case PaywallActionResult.accountConflict:
      showTopToast(
        context,
        tr('paywall.restoreAccountConflict'),
        variant: TopToastVariant.error,
      );
    case PaywallActionResult.error:
      showTopToast(
        context,
        tr('paywall.purchaseError'),
        variant: TopToastVariant.error,
      );
    case PaywallActionResult.cancelled:
      break;
  }
}
