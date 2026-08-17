import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../services/billing/entitlement_state.dart';
import '../../../shared/widgets/surface/kallo_primitives.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../../../theme/kallo_typography.dart';
import '../logic/store_subscriptions.dart';
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
        const Icon(LucideIcons.sparkles300, size: 32, color: KalloColors.accent),
        const SizedBox(height: KalloSpacing.sp4),
        Text(
          tr('paywall.alreadyPremiumTitle'),
          style: KalloTextStyles.serifRegular(
            fontSize: KalloFontSize.h2,
          ).copyWith(letterSpacing: -0.3, color: KalloColors.text),
        ),
        const SizedBox(height: KalloSpacing.sp3),
        Text(body, style: dashBody(color: kInkMuted)),
        const SizedBox(height: KalloSpacing.sp5),
        const PaywallFeatureList(),
        if (entitlement.hasActiveSubscription &&
            entitlement.managementUrl != null) ...[
          const SizedBox(height: KalloSpacing.sp6),
          KalloButton(
            title: tr('paywall.manageActive'),
            variant: KalloButtonVariant.secondary,
            onPressed:
                () =>
                    openStoreSubscriptions(context, entitlement.managementUrl!),
          ),
        ],
      ],
    );
  }
}
