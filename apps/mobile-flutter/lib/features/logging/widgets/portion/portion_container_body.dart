import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../models/vessel.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_colors.dart';
import '../../../../theme/nham_theme.dart';
import '../../logic/portion/portion_anchors.dart';
import '../../logic/portion/vessel_data.dart';
import 'portion_readout.dart';
import 'portion_slider.dart';

/// Container layout: a true-to-scale glyph row whose widths scale as
/// `cbrt(volume) * aspect` (tap to jump to a tier), the nearest-tier label, the
/// live gram/kcal readout, and a plain fine-adjustment slider.
///
/// Ported from `components/logging/feed/meal-entry/portion/portion-container-body.tsx`.
class PortionContainerBody extends StatelessWidget {
  const PortionContainerBody({
    super.key,
    required this.family,
    required this.anchors,
    required this.grams,
    required this.min,
    required this.max,
    required this.kcal,
    required this.sliderLabel,
    required this.onChanged,
  });

  final ContainerFamily family;
  final List<PortionAnchor> anchors;
  final int grams;
  final int min;
  final int max;
  final double kcal;
  final String sliderLabel;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final tiers = [for (final a in anchors) vesselFamilies[family]![a.tier]!];
    final largestMl = tiers.last.ml;
    final nearest = nearestAnchor(anchors, grams);
    final nearestTier = tiers[anchors.indexWhere((a) => a.tier == nearest.tier)];

    return Column(
      children: [
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 340),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end, // items-end
            spacing: NhamSpacing.sp2, // gap-2
            children: [
              for (final (index, anchor) in anchors.indexed)
                Expanded(
                  // Web gives each glyph `flex: cbrt(ml/largestMl) * aspect`.
                  // Flutter's flex is an int, so the same ratio is carried at
                  // 1000x — the row is laid out from the ratios, not the units.
                  flex:
                      (_glyphWeight(tiers[index], largestMl) * 1000).round(),
                  child: _GlyphButton(
                    tier: tiers[index],
                    label: anchor.label,
                    selected: anchor.tier == nearest.tier,
                    onTap: () {
                      HapticFeedback.selectionClick();
                      onChanged(anchor.value.round());
                    },
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: NhamSpacing.sp4), // mb-4
        Text(
          '${nearest.label} · ${nearestTier.sizeLabel}',
          textAlign: TextAlign.center,
          style: dashMeta(),
        ),
        const SizedBox(height: NhamSpacing.sp1), // mb-1
        PortionReadout(grams: grams, kcal: kcal),
        const SizedBox(height: NhamSpacing.sp4), // mb-4
        PortionSlider(
          value: grams.toDouble(),
          min: min.toDouble(),
          max: max.toDouble(),
          // One division per gram. Without it Flutter gives a continuous
          // slider a 5–10% semantic increment — ~56 g per screen-reader swipe
          // on a bowl envelope, where the web's arrow key moves 1 g.
          divisions: max - min,
          // Container anchors are NOT equally spaced in gram space (a tier-4
          // bowl is far more than 4x a tier-1), so the majors are computed from
          // where each anchor actually falls in the envelope — unlike the piece
          // ruler, whose slider runs in position space and spaces them evenly.
          majors: [
            for (final anchor in anchors)
              ((anchor.value - min) / (max - min)).clamp(0.0, 1.0),
          ],
          semanticLabel: sliderLabel,
          semanticValue:
              '$grams g — ${nearest.label} (${nearestTier.sizeLabel})',
          onChanged: (value) => onChanged(value.round()),
        ),
      ],
    );
  }

  /// Web's `Math.cbrt(ml / largestMl) * aspect`: volume enters as a cube root
  /// so a bowl twice the volume reads ~26% wider, not twice as wide, and the
  /// aspect converts that height-like scale into the width the row lays out on.
  static double _glyphWeight(VesselTierData tier, int largestMl) =>
      math.pow(tier.ml / largestMl, 1 / 3) * tier.asset.aspect;
}

/// One glyph in the container row: the silhouette at its own aspect, bottom
/// aligned, with the selected tier's accent underline beneath it.
class _GlyphButton extends StatelessWidget {
  const _GlyphButton({
    required this.tier,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final VesselTierData tier;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: '$label (${tier.sizeLabel})',
      excludeSemantics: true,
      onTap: onTap,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: AnimatedOpacity(
          duration: const Duration(milliseconds: 150),
          opacity: selected ? 1 : 0.45,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AspectRatio(
                aspectRatio: tier.asset.aspect,
                child: Image.asset(
                  tier.asset.path,
                  fit: BoxFit.contain,
                  alignment: Alignment.bottomCenter,
                ),
              ),
              const SizedBox(height: NhamSpacing.sp1), // mt-1
              Container(
                width: 24, // w-6
                height: 2, // h-0.5
                decoration: BoxDecoration(
                  color: selected ? NhamColors.accent : Colors.transparent,
                  borderRadius: BorderRadius.circular(NhamRadii.pill),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
