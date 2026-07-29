import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../data/billing/entitlements_provider.dart';
import '../../../shared/widgets/nham_primitives.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../store_subscriptions.dart';
import 'paywall_features.dart';

/// Confirmation and store-management state for premium and lifetime users.
class PaywallPremiumBody extends StatelessWidget {
  const PaywallPremiumBody({required this.entitlement, super.key});

  final EntitlementState entitlement;

  @override
  Widget build(BuildContext context) {
    final body =
        entitlement.isLifetime
            ? tr('paywall.alreadyLifetimeBody')
            : tr('paywall.alreadyPremiumBody');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Icon(LucideIcons.sparkles, size: 32, color: NhamColors.accent),
        const SizedBox(height: NhamSpacing.sp4),
        Text(
          tr('paywall.alreadyPremiumTitle'),
          style: NhamTextStyles.serifRegular(
            fontSize: NhamFontSize.h2,
          ).copyWith(letterSpacing: -0.3, color: NhamColors.text),
        ),
        const SizedBox(height: NhamSpacing.sp3),
        Text(body, style: dashBody(color: kInkMuted)),
        const SizedBox(height: NhamSpacing.sp5),
        const PaywallFeatureList(),
        if (entitlement.hasActiveSubscription &&
            entitlement.managementUrl != null) ...[
          const SizedBox(height: NhamSpacing.sp6),
          NhamButton(
            title: tr('paywall.manageActive'),
            variant: NhamButtonVariant.secondary,
            onPressed:
                () =>
                    openStoreSubscriptions(context, entitlement.managementUrl!),
          ),
        ],
      ],
    );
  }
}
