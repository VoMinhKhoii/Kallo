import 'package:flutter/painting.dart';

import '../../../theme/kallo_colors.dart';
import '../../../theme/kallo_gradients.dart';
import '../../../theme/kallo_palette.dart';

/// The in-app primary fill — Save, Share, Retry, Send — defined once for every
/// button that wears it.
///
/// Light and Dark paint the warm [KalloColors.btnPrimarySoft] wash under an
/// ink label. Aurora paints the brand sweep ([KalloGradients.brandSweep])
/// under [KalloColors.onBrand]: the sweep's two hues are the same in every
/// palette, so its label is too. A press darkens either fill — the press wash
/// over the solid colour, ink at 12% over the sweep, where a white wash would
/// vanish into the apricot.
///
/// A decoration takes [color] and [gradient] together; exactly one of them is
/// non-null.
abstract final class PrimaryFill {
  static bool get _sweep => KalloPalette.currentId == KalloPaletteId.aurora;

  /// The solid fill, or null under the sweep.
  static Color? color({bool pressed = false}) {
    if (_sweep) return null;
    final base = KalloColors.btnPrimarySoft;
    return pressed ? Color.alphaBlend(KalloColors.pressWash, base) : base;
  }

  /// The sweep, or null outside Aurora.
  static Gradient? gradient({bool pressed = false}) {
    if (!_sweep) return null;
    const sweep = KalloGradients.brandSweep;
    if (!pressed) return sweep;
    return LinearGradient(
      begin: sweep.begin,
      end: sweep.end,
      colors: [
        for (final stop in sweep.colors)
          Color.alphaBlend(KalloColors.pressWashOnGold, stop),
      ],
    );
  }

  /// The label, glyph and spinner colour on the fill.
  static Color get label => _sweep ? KalloColors.onBrand : KalloColors.text;
}
