import 'package:flutter/material.dart';

import '../../../../models/nutrition/vessel.dart';
import '../../logic/portion/portion_anchors.dart';
import '../../logic/portion/vessel_data.dart';

/// The two silhouettes the ruler draws: a piece cut and a container.
class PortionGlyph extends StatelessWidget {
  const PortionGlyph({
    super.key,
    required this.tier,
    required this.kind,
    required this.columnWidth,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final PieceTier tier;
  final PieceKind kind;
  final double columnWidth;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final asset = tier.assetFor(kind);
    final width = columnWidth * glyphWidthRatio(tier.grams, asset.aspect);

    return Semantics(
      button: true,
      selected: selected,
      label: '$label (${tier.sizeLabel})',
      excludeSemantics: true,
      onTap: onTap,
      child: GestureDetector(
        // Opaque so the tap target tiles the full column height instead of
        // shrinking to a 20px silhouette at the small end of the ruler.
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Align(
          alignment: Alignment.bottomCenter,
          child: AnimatedOpacity(
            duration: const Duration(milliseconds: 150),
            opacity: selected ? 1 : 0.5,
            child: SizedBox(
              width: width,
              height: width / asset.aspect,
              child: Image.asset(
                asset.path,
                fit: BoxFit.contain,
                alignment: Alignment.bottomCenter,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A container silhouette on the ruler strip — bowl, plate or cup. Sized by the
/// caller (volume enters as a cube root), bottom-aligned so every vessel sits
/// on the same baseline whatever its aspect.
class PortionVesselGlyph extends StatelessWidget {
  const PortionVesselGlyph({
    super.key,
    required this.asset,
    required this.width,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final VesselAsset asset;
  final double width;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      excludeSemantics: true,
      onTap: onTap,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Align(
          alignment: Alignment.bottomCenter,
          child: AnimatedOpacity(
            duration: const Duration(milliseconds: 150),
            opacity: selected ? 1 : 0.45,
            child: SizedBox(
              width: width,
              height: width / asset.aspect,
              child: Image.asset(
                asset.path,
                fit: BoxFit.contain,
                alignment: Alignment.bottomCenter,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
