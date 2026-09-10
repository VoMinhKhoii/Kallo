import 'package:flutter/painting.dart';

/// Brand gradients — the app's first gradient token.
///
/// Colour, type, spacing and motion all resolve to a named token set; a
/// gradient had never been one of them because the app only had a single
/// gradient surface (the onboarding aurora) and it painted its own. The moment
/// a second surface wanted the same two hues, "the brand sweep" needed an
/// answer you could look up.
abstract final class KalloGradients {
  /// The two brand hues of the onboarding sweep, at FULL opacity, running
  /// topLeft → bottomRight.
  ///
  /// **The saturated sibling of `AuroraSpec`**
  /// (`features/onboarding/widgets/backdrop/start_aurora.dart`). Same apricot
  /// `#FFD2B0` → lilac `#DCC4FF` ramp, same brand reading — different job, so
  /// it cannot simply reuse the aurora's alphas.
  ///
  /// The aurora is a full-bleed WASH behind a whole screen: it runs 0.55 → 0
  /// apricot with two glows at 0.16/0.14, deliberately weak so the wordmark
  /// and the device preview stay the subjects, and it works because it covers
  /// hundreds of points of height. This token fills a **52pt disc on a white
  /// capsule**. At the aurora's alphas those hues composite to within a few
  /// points of `#FFFFFF` over that little area — the gradient would be
  /// invisible, which is the one thing the tab bar's "+" must not be. Full
  /// opacity is what makes it read at that size.
  ///
  /// Diagonal rather than the aurora's vertical: on a circle a topCenter →
  /// bottomCenter ramp reads as a horizontal seam, while the diagonal keeps
  /// both stops on the glyph's own axis.
  ///
  /// Ink (`KalloColors.text` `#141413`) clears WCAG AA on BOTH stops —
  /// 13.2:1 on the apricot, 11.7:1 on the lilac — so a glyph drawn on it stays
  /// on the app's two-text-colour system with no third "on-gradient" colour.
  static const LinearGradient brandSweep = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFFFD2B0), Color(0xFFDCC4FF)],
  );
}
