import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../data/billing/entitlements_provider.dart';
import '../../../shared/widgets/nham_primitives.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_theme.dart';
import '../paywall_controller.dart';
import '../widgets/paywall_premium_body.dart';
import '../widgets/paywall_purchase_body.dart';
import '../widgets/paywall_status.dart';

/// AI-analysis-focused paywall. Free users see an upsell or trial-expired
/// variant, while premium users see their active plan and store-management CTA.
class PaywallScreen extends ConsumerWidget {
  const PaywallScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userId = ref.watch(entitlementsUserIdProvider);
    final entitlement = ref.watch(entitlementsProvider(userId));
    final state = ref.watch(paywallControllerProvider);

    return Screen(
      bottom: false,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _CloseHeader(onClose: () => _dismiss(context)),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(
                NhamSpacing.sp5,
                NhamSpacing.sp4,
                NhamSpacing.sp5,
                NhamSpacing.sp8,
              ),
              child: entitlement.when(
                data:
                    (value) =>
                        value.isPremium
                            ? PaywallPremiumBody(entitlement: value)
                            : PaywallPurchaseBody(
                              entitlement: value,
                              state: state,
                            ),
                loading:
                    () => PaywallNote(
                      title: tr('paywall.verifying'),
                      body: tr('paywall.verifyPending'),
                      leading: const PaywallSpinner(),
                    ),
                error:
                    (_, _) => PaywallRetryNote(
                      message: tr('paywall.loadError'),
                      onRetry:
                          () =>
                              ref
                                  .read(entitlementsProvider(userId).notifier)
                                  .reconcile(),
                    ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _dismiss(BuildContext context) {
    final router = GoRouter.of(context);
    if (router.canPop()) {
      router.pop();
    } else {
      context.go('/logging');
    }
  }
}

class _CloseHeader extends StatelessWidget {
  const _CloseHeader({required this.onClose});

  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: NhamSpacing.sp4,
        vertical: NhamSpacing.sp3,
      ),
      child: Align(
        alignment: Alignment.centerRight,
        child: Semantics(
          button: true,
          label: tr('common.close'),
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onClose,
            child: const Icon(LucideIcons.x, size: NhamIcons.size, color: kInkMuted),
          ),
        ),
      ),
    );
  }
}
