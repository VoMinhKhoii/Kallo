import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';

class PaywallFeatureList extends StatelessWidget {
  const PaywallFeatureList({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _FeatureRow(text: tr('paywall.feature1')),
        const SizedBox(height: KalloSpacing.sp3),
        _FeatureRow(text: tr('paywall.feature2')),
        const SizedBox(height: KalloSpacing.sp3),
        _FeatureRow(text: tr('paywall.feature3')),
      ],
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
            LucideIcons.check300,
            size: 17,
            color: KalloColors.accentDark,
          ),
        ),
        const SizedBox(width: KalloSpacing.sp3),
        Expanded(child: Text(text, style: dashBody())),
      ],
    );
  }
}
