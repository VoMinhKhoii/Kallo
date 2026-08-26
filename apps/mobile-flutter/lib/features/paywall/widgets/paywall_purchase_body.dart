import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../services/billing/entitlement_state.dart';
import '../../../shared/logic/legal_links.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../../../theme/kallo_typography.dart';
import '../data/paywall_controller.dart';
import 'paywall_features.dart';
import 'paywall_package_section.dart';

// URLs and the in-app browser come from `shared/logic/legal_links.dart`: these
// are the same two pages the settings About group links to, and they used to be
// reached here through the bare redirect paths, which re-detect the locale from
// scratch instead of landing in the app's own language.

/// The upsell / trial-expired variant: pitch, package cards, and restore/legal
/// actions.
class PaywallPurchaseBody extends StatelessWidget {
  const PaywallPurchaseBody({
    required this.entitlement,
    required this.state,
    super.key,
  });

  final EntitlementState entitlement;
  final PaywallState state;

  bool get _expiredVariant =>
      entitlement.aiAnalysis.reason == FeatureReason.trialExpired;

  @override
  Widget build(BuildContext context) {
    final languageCode = context.locale.languageCode;
    final eyebrow = tr(
      _expiredVariant ? 'paywall.expiredEyebrow' : 'paywall.upsellEyebrow',
    );
    final title = tr(
      _expiredVariant ? 'paywall.expiredTitle' : 'paywall.upsellTitle',
    );
    final body = tr(
      _expiredVariant ? 'paywall.expiredBody' : 'paywall.upsellBody',
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(eyebrow.toUpperCase(), style: dashEyebrow()),
        const SizedBox(height: KalloSpacing.sp2),
        Text(
          title,
          style: KalloTextStyles.serifRegular(
            fontSize: KalloFontSize.h2,
          ).copyWith(letterSpacing: -0.3, color: KalloColors.text),
        ),
        const SizedBox(height: KalloSpacing.sp3),
        Text(body, style: dashBody(color: kInkMuted)),
        if (entitlement.trial.active) ...[
          const SizedBox(height: KalloSpacing.sp4),
          PaywallTrialCountdown(trial: entitlement.trial),
        ],
        const SizedBox(height: KalloSpacing.sp5),
        const PaywallFeatureList(),
        const SizedBox(height: KalloSpacing.sp5),
        PaywallPackageSection(entitlement: entitlement, state: state),
        const SizedBox(height: KalloSpacing.sp4),
        Text(
          tr('paywall.legal'),
          style: dashMeta().copyWith(height: 1.4),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: KalloSpacing.sp2),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TextButton(
              onPressed:
                  () => openLegalPage(context, termsUrlFor(languageCode)),
              child: Text(tr('paywall.terms')),
            ),
            TextButton(
              onPressed:
                  () => openLegalPage(context, privacyUrlFor(languageCode)),
              child: Text(tr('paywall.privacy')),
            ),
          ],
        ),
      ],
    );
  }
}
