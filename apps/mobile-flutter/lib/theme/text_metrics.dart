/// Text measurements the layout code needs BEFORE it has a painter: how tall
/// one line of a style actually is.
///
/// Hard-coded line boxes are the recurring bug this replaces — the heatmap's
/// month strip and the weight chart's date row were both sized for the retired
/// 12pt meta tier and clipped the current 14 × 1.25 box (and every scaled-up
/// variant of it). Measure from the style that will actually paint.
library;

import 'package:flutter/painting.dart';

/// The height of a single line box for [style] at [scaler]: the scaled font
/// size times its leading, rounded up to a whole pixel so nothing below ever
/// starts on a fraction of a row.
///
/// [TextStyle.height] defaults to 1.25 — the app's own leading — when the style
/// leaves it unset. [TextStyle.fontSize] has no such fallback: a style with no
/// size cannot be measured, and silently guessing one is how the wrong height
/// gets baked in again, so it throws.
double lineBoxHeight(TextStyle style, TextScaler scaler) {
  final fontSize = style.fontSize;
  if (fontSize == null) {
    throw ArgumentError.value(
      style,
      'style',
      'lineBoxHeight needs a fontSize to measure; resolve the style against '
          'the theme before measuring it',
    );
  }
  return (scaler.scale(fontSize) * (style.height ?? 1.25)).ceilToDouble();
}
