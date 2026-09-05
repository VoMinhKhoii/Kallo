import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../services/billing/entitlement_state.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import 'paywall_features.dart';

/// The pitch above the plan sheet: the title, the trial countdown while one is
/// running, and the four things Pro adds to Free.
///
/// It sits on the warm [KalloColors.hover] band the screen paints, so it
/// carries no surface of its own — the white sheet below is the only object on
/// this screen.
class PaywallProBand extends StatelessWidget {
  const PaywallProBand({required this.entitlement, super.key});

  final EntitlementState entitlement;

  static const List<String> featureKeys = [
    'paywall.proFeatureWords',
    'paywall.proFeatureMicros',
    'paywall.proFeatureTools',
    'paywall.proFeatureCircle',
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(tr('paywall.proTitle'), style: kPageTitle()),
        if (entitlement.trial.active) ...[
          const SizedBox(height: KalloSpacing.sp3),
          Align(
            alignment: Alignment.centerLeft,
            child: PaywallTrialCountdown(trial: entitlement.trial),
          ),
        ],
        const SizedBox(height: KalloSpacing.sp3),
        Text(tr('paywall.proSubtitle'), style: dashMeta()),
        const SizedBox(height: KalloSpacing.sp4),
        for (final key in featureKeys) ...[
          _CheckRow(text: tr(key)),
          const SizedBox(height: KalloSpacing.sp3),
        ],
      ],
    );
  }
}

class _CheckRow extends StatelessWidget {
  const _CheckRow({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(top: 2),
          child: Icon(
            LucideIcons.check300,
            size: KalloIcons.tertiary,
            color: KalloColors.successAccent,
          ),
        ),
        const SizedBox(width: KalloSpacing.sp3),
        Expanded(child: Text(text, style: dashBody())),
      ],
    );
  }
}
