import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../../theme/kallo_colors.dart';
import 'wordmark_glyphs.dart';

/// The Kallo wordmark — the segmented K as its capital plus "allo", from
/// `docs/brand/kallo/assets/kallo-wordmark.svg`. The capital IS the brand
/// mark, so never render a separate mark next to this widget.
///
/// Inline SVG string (not an asset) to match [GoogleLogo]'s pattern and keep
/// the vector renderable without pubspec asset registration.
class KalloWordmark extends StatelessWidget {
  const KalloWordmark({this.height = 16, this.color, super.key});

  /// Rendered height; width follows the 2180:812 viewBox ratio.
  final double height;

  /// Tint. Defaults to the ink text color.
  final Color? color;

  static const double _aspectRatio = 2180 / 812;

  @override
  Widget build(BuildContext context) {
    return SvgPicture.string(
      _svg,
      height: height,
      width: height * _aspectRatio,
      colorFilter: ColorFilter.mode(color ?? KalloColors.text, BlendMode.srcIn),
      semanticsLabel: 'Kallo',
    );
  }
}

// One copy of the geometry: the launch intro draws the same letters one by one.
const String _svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2180 812">'
    '<path fill="#141413" d="${WordmarkGlyphs.svgPathData}" />'
    '</svg>';
