import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../../theme/calm_tokens.dart';
import '../../../../theme/kallo_colors.dart';

/// The Log screen behind a phone bezel. Rendered at design size and scaled by
/// the [FittedBox] above it.
class StartDevicePreview extends StatelessWidget {
  const StartDevicePreview({super.key});

  /// The device card, so a layout test can measure what it actually got.
  static const Key previewKey = ValueKey('start-preview');

  static const double width = 206;
  static const double cardHeight = 412;
  static const double radius = 34;
  static const double outline = 5;

  /// The canvas's dissolve, to the point: a 130pt band starting [fadeLead]
  /// ABOVE the card's bottom edge and ending [titleOffset] below it, going
  /// full canvas at [fadeStop] of its length — 27pt past the card's bottom.
  ///
  /// So the device's bottom edge is NOT hidden here; it fades out under the
  /// band, which is how the approved render reads. Earlier passes ran the ramp
  /// far enough up the card to erase the edge outright, and that swallowed the
  /// two lowest dishes with it. This is the band the scatter was drawn for.
  static const double fadeLead = 74;

  /// How far the band runs PAST the card's bottom edge — and so how far below
  /// it the title's top sits, because the block ends there and the title is
  /// the next thing in the column. By then the band has been solid canvas for
  /// 29pt.
  static const double titleOffset = 56;

  /// The band itself is [fadeLead] + [titleOffset] = 130pt tall; it needs no
  /// constant of its own because it runs from here to the block's bottom.
  static const double fadeTop = cardHeight - fadeLead;
  static const double fadeStop = 0.78;

  /// The block ends where the band does: nothing — no dish, no card edge, no
  /// elevation shadow — is drawn below it.
  static const double blockHeight = cardHeight + titleOffset;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: previewKey,
      decoration: BoxDecoration(
        color: KalloColors.elev,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: kInk, width: outline),
        boxShadow: const [
          BoxShadow(
            // 0 22 44 rgba(20,20,19,.20) — the one true elevation on this
            // screen.
            color: Color(0x33141413),
            blurRadius: 44,
            offset: Offset(0, 22),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(radius - outline),
        // The Log screen in the app's own language, so English never opens
        // on a Vietnamese meal log.
        child: Image(
          image: AssetImage(
            'assets/onboarding/log_preview_${context.locale.languageCode}.webp',
          ),
          fit: BoxFit.cover,
          alignment: Alignment.topCenter,
          excludeFromSemantics: true,
        ),
      ),
    );
  }
}
