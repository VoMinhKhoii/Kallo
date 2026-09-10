import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

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
/// The bubble carries the ONE line worth saying before the table, and it is
/// handed in rather than chosen here: it has to agree with the chip and the
/// renewal line under it, so `logic/plan_offer.dart` decides all of them at
/// once.
class PaywallGuide extends StatelessWidget {
  const PaywallGuide({required this.line, super.key});

  /// What the bun says — [PaywallOffer.guideLine].
  final String line;

  /// Smaller than the onboarding band's 84: this screen has a table to fit.
  static const double bunSize = 62;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      BunMascot(size: bunSize, speech: line),
      const SizedBox(height: KalloSpacing.sp3),
      Text(tr('paywall.choosePlan'), style: kPageTitle()),
    ],
  );
}
