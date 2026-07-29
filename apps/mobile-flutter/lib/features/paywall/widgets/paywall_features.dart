import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../data/billing/entitlements_provider.dart';
import '../../../theme/calm_tokens.dart';
import '../../../theme/nham_colors.dart';
import '../../../theme/nham_theme.dart';

class PaywallFeatureList extends StatelessWidget {
  const PaywallFeatureList({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _FeatureRow(text: tr('paywall.feature1')),
        const SizedBox(height: NhamSpacing.sp3),
        _FeatureRow(text: tr('paywall.feature2')),
        const SizedBox(height: NhamSpacing.sp3),
        _FeatureRow(text: tr('paywall.feature3')),
      ],
    );
  }
}

class PaywallTrialCountdown extends StatelessWidget {
  const PaywallTrialCountdown({required this.trial, super.key});

  final TrialState trial;

  @override
  Widget build(BuildContext context) {
    final label =
        trial.daysRemaining <= 1
            ? tr('paywall.trialCountdownLastDay')
            : tr(
              'paywall.trialCountdown',
              namedArgs: {'days': '${trial.daysRemaining}'},
            );
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: NhamSpacing.sp3,
        vertical: NhamSpacing.sp2_5,
      ),
      decoration: BoxDecoration(
        color: NhamColors.accent10,
        borderRadius: BorderRadius.circular(NhamRadii.buttonXl),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(LucideIcons.clock, size: 15, color: NhamColors.accentDark),
          const SizedBox(width: NhamSpacing.sp2),
          Flexible(
            child: Text(
              label,
              style: dashMeta(
                color: NhamColors.text,
              ).copyWith(fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ),
    );
  }
}

class _FeatureRow extends StatelessWidget {
  const _FeatureRow({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(top: 1),
          child: Icon(
            LucideIcons.check,
            size: 17,
            color: NhamColors.accentDark,
          ),
        ),
        const SizedBox(width: NhamSpacing.sp3),
        Expanded(child: Text(text, style: dashBody())),
      ],
    );
  }
}
