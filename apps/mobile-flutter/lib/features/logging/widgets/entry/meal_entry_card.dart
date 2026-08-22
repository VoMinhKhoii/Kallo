import 'package:flutter/material.dart';

import '../../../../theme/kallo_colors.dart';
import '../../../../theme/kallo_theme.dart';
import '../../logic/logging_spacing.dart';

/// The unconfirmed meal's card: solid white on the neutral canvas.
///
/// White is not negotiable per-instance. The reveal path used to paint it
/// [KalloColors.surface] "to match the streaming card's background" — but the
/// streaming card is [KalloColors.elev], white, so the two never matched. What
/// it actually did was paint the card in the CANVAS colour, which is why a
/// meal awaiting confirmation looked transparent: its fill was the page behind
/// it. Both cards being white is what removes the seam the parameter was
/// reaching for.
class MealEntryCard extends StatelessWidget {
  const MealEntryCard({super.key, required this.child, this.editing = false});
  final Widget child;

  /// Editing lifts the hairline to the accent this app already uses for a
  /// focused input, on the WHOLE card.
  ///
  /// It replaces a grey wash behind each row, which said "these three rows are
  /// something" without saying what, cost every row an 8pt inset that shifted
  /// its contents, and repeated the message once per item. Ringing the card
  /// states it once, in the app's existing vocabulary for "this is live", and
  /// moves nothing.
  final bool editing;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 150), // transition-colors
      padding: LoggingSpacing.card,
      decoration: BoxDecoration(
        color: KalloColors.elev, // solid white card on neutral canvas
        borderRadius: BorderRadius.circular(KalloRadii.containerLg),
        border: Border.all(
          color: editing ? KalloColors.accent40 : KalloColors.borderSoft,
        ),
        boxShadow: const [KalloShadows.sm],
      ),
      child: child,
    );
  }
}
