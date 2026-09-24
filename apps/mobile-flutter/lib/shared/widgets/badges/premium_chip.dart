import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_theme.dart';
import '../../../theme/kallo_typography.dart';

/// The soft-blue "Premium" pill that marks an option the user's plan does not
/// include. Same spec as web's `PremiumChip` (round 6, approved): 18pt tall,
/// 7pt side padding, 1px border, 11/600 sentence-case label.
///
/// Weight 600 is outside mobile.md's three semibold tokens on purpose: the
/// approved canvas sets the chip 11/600 on both platforms, so the marker reads
/// the same on web and in the app.
///
/// It sits at the far RIGHT of an option row (left of any trailing check) — a
/// marker, never a button of its own: the row's tap is what opens the paywall.
/// Show it only when `premiumLockProvider(feature)` is true.
class PremiumChip extends StatelessWidget {
  const PremiumChip({super.key});

  static const double height = 18;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      padding: const EdgeInsets.symmetric(horizontal: 7),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: KalloColors.premiumChipFill,
        border: Border.all(color: KalloColors.premiumChipBorder),
        borderRadius: BorderRadius.circular(KalloRadii.pill),
      ),
      child: Text(
        'paywall.premiumChip'.tr(),
        // The pill is a fixed 18pt: past 1.0x the label would clip its own
        // border, and the chip is a marker whose meaning the row label carries.
        textScaler: TextScaler.noScaling,
        style: const TextStyle(
          fontFamily: KalloTextStyles.sansFamily,
          fontSize: 11,
          fontWeight: FontWeight.w600,
          height: 1.0,
          color: KalloColors.premiumChipText,
        ),
      ),
    );
  }
}
