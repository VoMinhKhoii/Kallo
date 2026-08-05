import 'package:flutter/material.dart';

import '../../../../models/vessel.dart';
import '../../logic/portion/portion_anchors.dart';
import '../../logic/portion/vessel_data.dart';

/// The silhouette row: n equal columns, each glyph bottom-aligned and sized by
/// area so twice the food looks twice as big.
class PortionGlyphRow extends StatelessWidget {
  const PortionGlyphRow({
    super.key,
    required this.anchors,
    required this.kind,
    required this.countPrefix,
    required this.claimedTier,
    required this.onPick,
  });

  final List<PortionAnchor> anchors;
  final PieceKind kind;
  final String countPrefix;
  final int? claimedTier;
  final ValueChanged<int> onPick;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columnWidth = constraints.maxWidth / anchors.length;
        return Row(
          children: [
            for (final anchor in anchors)
              Expanded(
                child: PortionGlyph(
                  tier: pieceTiers[anchor.tier - 1],
                  kind: kind,
                  columnWidth: columnWidth,
                  label: '$countPrefix${anchor.label}',
                  selected: anchor.tier == claimedTier,
                  onTap: () => onPick(anchor.value.round()),
                ),
              ),
          ],
        );
      },
    );
  }
}

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
