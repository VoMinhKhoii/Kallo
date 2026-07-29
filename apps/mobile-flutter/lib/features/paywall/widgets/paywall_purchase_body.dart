import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../data/billing/entitlements_provider.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';
import '../../../theme/nham_typography.dart';
import '../paywall_controller.dart';
import 'paywall_features.dart';
import 'paywall_package_section.dart';

const _termsUrl = 'https://kallo.fit/terms';
const _privacyUrl = 'https://kallo.fit/privacy';

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
        const SizedBox(height: NhamSpacing.sp2),
        Text(
          title,
          style: NhamTextStyles.serifRegular(
            fontSize: NhamFontSize.h2,
          ).copyWith(letterSpacing: -0.3, color: NhamColors.text),
        ),
        const SizedBox(height: NhamSpacing.sp3),
        Text(body, style: dashBody(color: kInkMuted)),
        if (entitlement.trial.active) ...[
          const SizedBox(height: NhamSpacing.sp4),
          PaywallTrialCountdown(trial: entitlement.trial),
        ],
        const SizedBox(height: NhamSpacing.sp5),
        const PaywallFeatureList(),
        const SizedBox(height: NhamSpacing.sp5),
        PaywallPackageSection(entitlement: entitlement, state: state),
        const SizedBox(height: NhamSpacing.sp4),
        Text(
          tr('paywall.legal'),
          style: dashMeta().copyWith(height: 1.4),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: NhamSpacing.sp2),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TextButton(
              onPressed: () => _openLegalUrl(_termsUrl),
              child: Text(tr('paywall.terms')),
            ),
            TextButton(
              onPressed: () => _openLegalUrl(_privacyUrl),
              child: Text(tr('paywall.privacy')),
            ),
          ],
        ),
      ],
    );
  }

  void _openLegalUrl(String url) {
    launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }
}
