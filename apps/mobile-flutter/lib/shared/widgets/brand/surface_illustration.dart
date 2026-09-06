import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../../theme/kallo_colors.dart';
import '../../data/surface_cast.dart';
import '../../logic/time_of_day.dart';

/// One hand-drawn Koboyo animal, picked for the surface it stands on and for
/// the hour of the day. Ink is baked into the asset and recoloured here with a
/// [ColorFilter] — the same recipe as `kallo_mark.dart`.
///
/// Decorative by definition: the title beneath it says everything the art does,
/// so it stays out of the semantics tree.
class SurfaceIllustration extends StatelessWidget {
  const SurfaceIllustration({
    super.key,
    required this.area,
    required this.kind,
    this.height = 120,
    this.color = KalloColors.text,
    this.now,
  });

  final SurfaceArea area;
  final SurfaceKind kind;

  /// Rendered height; width is left unset so the art keeps its own viewBox
  /// ratio (the poses are not a single aspect).
  final double height;

  final Color color;

  /// The clock, injectable so a test can stand at 23:00.
  final DateTime Function()? now;

  @override
  Widget build(BuildContext context) {
    final hour = (now ?? DateTime.now)().hour;
    return SvgPicture.asset(
      surfaceIllustrationAsset(area, kind, lateNight: isLateNight(hour)),
      height: height,
      colorFilter: ColorFilter.mode(color, BlendMode.srcIn),
      excludeFromSemantics: true,
    );
  }
}
