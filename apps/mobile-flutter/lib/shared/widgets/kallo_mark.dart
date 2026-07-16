import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../theme/nham_colors.dart';

/// The Kallo mark alone (segmented K) for icons and tight spaces — from
/// `docs/brand/kallo/assets/kallo-mark.svg`. Never render this next to
/// [KalloWordmark]; the wordmark's capital already is the mark.
class KalloMark extends StatelessWidget {
  const KalloMark({this.height = 20, this.color, super.key});

  /// Rendered height; width follows the 656:708 viewBox ratio.
  final double height;

  /// Tint. Defaults to the espresso text color.
  final Color? color;

  static const double _aspectRatio = 656 / 708;

  @override
  Widget build(BuildContext context) {
    return SvgPicture.string(
      _svg,
      height: height,
      width: height * _aspectRatio,
      colorFilter: ColorFilter.mode(
        color ?? NhamColors.text,
        BlendMode.srcIn,
      ),
      semanticsLabel: 'Kallo',
    );
  }
}

const String _svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 656 708">'
    '<path fill="#2C2416" d="M0 0H168V708H0ZM424 0H638L410 277H196ZM196 389H419L656 708H433Z" />'
    '</svg>';
