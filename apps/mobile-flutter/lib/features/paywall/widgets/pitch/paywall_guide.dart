import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../services/billing/entitlement_state.dart';
import '../../../../shared/widgets/mascot/bun_mascot.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_theme.dart';

/// The bun and its bubble, then the screen's title.
///
/// The same [BunMascot] guide band that walks the user through all six
/// onboarding screens, arriving one screen further — so the paywall speaks in
/// a voice they already know rather than in a pricing page's. It is the widget
/// itself, not a copy: the blink, the breath and the typewriter come with it.
///
/// The bubble carries the ONE number worth saying before the table: how much
/// the yearly plan saves, or — while a trial is running — how much of it is
/// left, which is the more useful fact at that moment and reuses the string
/// the old countdown pill printed.
class PaywallGuide extends StatelessWidget {
  const PaywallGuide({
    required this.trial,
    required this.savePercent,
    super.key,
  });

  final TrialState trial;

  /// The yearly saving, or null when it cannot be computed (no monthly plan to
  /// compare against, or two currencies). A boast we cannot back is not made.
  final int? savePercent;

  /// Smaller than the onboarding band's 84: this screen has a table to fit.
  static const double bunSize = 62;

  String _speech() {
    if (trial.active) {
      return trial.daysRemaining <= 1
          ? tr('paywall.trialCountdownLastDay')
          : tr(
              'paywall.trialCountdown',
              namedArgs: {'days': '${trial.daysRemaining}'},
            );
    }
    final percent = savePercent;
    if (percent == null) return tr('paywall.guideUnlock');
    return tr('paywall.guideSavings', namedArgs: {'percent': '$percent'});
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        BunMascot(size: bunSize, speech: _speech()),
        const SizedBox(height: KalloSpacing.sp3),
        Text(tr('paywall.choosePlan'), style: kPageTitle()),
      ],
    );
  }
}
