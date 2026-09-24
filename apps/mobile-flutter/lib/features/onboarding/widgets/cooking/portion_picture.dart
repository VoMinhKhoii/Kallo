import 'package:flutter/widgets.dart';

import '../../../../shared/data/portion_assets.dart';

/// A portion drawing on the trailing edge of a cooking row, right-aligned in
/// a fixed box so the three rows' text columns line up. It GROWS with the
/// answer ([rank] 0–2) — the size step is the point of the picture, so it
/// is never scaled to fill.
class PortionPicture extends StatelessWidget {
  const PortionPicture({super.key, required this.file, required this.rank});

  final String file;
  final int rank;

  static const double width = 72, height = 48;

  /// Drawing height per rank: small, medium, large.
  static const List<double> _heights = [30, 40, 48];

  @override
  Widget build(BuildContext context) => SizedBox(
    width: width,
    height: height,
    child: Align(
      alignment: Alignment.centerRight,
      child: Image.asset(
        '$portionAssetDir/$file',
        height: _heights[rank.clamp(0, _heights.length - 1)],
        fit: BoxFit.contain,
      ),
    ),
  );
}
