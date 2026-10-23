import 'package:flutter/material.dart';

import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/logging_spacing.dart';

/// The unconfirmed meal's card: solid white on the neutral canvas, borderless
/// and flat like every other card since the native pass — the surface step is
/// what separates it.
///
/// White is not negotiable per-instance. The reveal path used to paint it
/// [KalloColors.surface] "to match the streaming card's background" — but the
/// streaming card is [KalloColors.elev], white, so the two never matched. What
/// it actually did was paint the card in the CANVAS colour, which is why a
/// meal awaiting confirmation looked transparent: its fill was the page behind
/// it. Both cards being white is what removes the seam the parameter was
/// reaching for.
class MealEntryCard extends StatelessWidget {
  const MealEntryCard({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: LoggingSpacing.card,
      decoration: BoxDecoration(
        color: KalloColors.elev, // solid white card on neutral canvas
        borderRadius: BorderRadius.circular(KalloRadii.card),
      ),
      child: child,
    );
  }
}
