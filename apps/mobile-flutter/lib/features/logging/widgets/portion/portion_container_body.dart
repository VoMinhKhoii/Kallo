import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../models/vessel.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_theme.dart';
import '../../logic/portion/portion_anchors.dart';
import '../../logic/portion/ruler_scale.dart';
import '../../logic/portion/vessel_data.dart';
import 'portion_glyph_row.dart';
import 'portion_readout.dart';
import 'portion_ruler_face.dart';
import 'portion_ruler_strip.dart';

/// Container layout: the SAME tape ruler the piece branch uses, with bowl /
/// plate / cup silhouettes on it.
///
/// It used to be a separate control — a flex-weighted glyph row over a plain
/// gram slider — which meant one sheet showed two different sliders depending
/// on what you ate. The scale is shared now; only the art and the tier labels
/// differ.
class PortionContainerBody extends StatefulWidget {
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
  State<PortionContainerBody> createState() => _PortionContainerBodyState();
}

class _PortionContainerBodyState extends State<PortionContainerBody> {
  late RulerScale _scale = _buildScale();
  late int _ownGrams = widget.grams;

  RulerScale _buildScale() =>
      RulerScale(widget.anchors, widget.min, widget.max);

  List<VesselTierData> get _tiers => [
    for (final a in widget.anchors) vesselFamilies[widget.family]![a.tier]!,
  ];

  /// Glyph widths as a fraction of a column, normalised so the largest vessel
  /// exactly fills its slot. Volume enters as a cube root — a bowl twice the
  /// volume reads ~26% wider, not twice as wide — and the aspect turns that
  /// height-like scale into the width the row lays out on.
  List<double> get _widthRatios {
    final largestMl = _tiers.last.ml;
    final weights = [
      for (final tier in _tiers)
        (math.pow(tier.ml / largestMl, 1 / 3) * tier.asset.aspect).toDouble(),
    ];
    final widest = weights.reduce(math.max);
    return [for (final w in weights) w / widest];
  }

  @override
  void didUpdateWidget(PortionContainerBody oldWidget) {
    super.didUpdateWidget(oldWidget);
    final next = _buildScale();
    if (next.differsFrom(_scale)) {
      _scale = next;
      _ownGrams = widget.grams;
      return;
    }
    if (widget.grams != _ownGrams) _ownGrams = widget.grams;
  }

  void _emit(int grams) {
    setState(() => _ownGrams = grams);
    widget.onChanged(grams);
  }

  @override
  Widget build(BuildContext context) {
    final ratios = _widthRatios;
    final tiers = _tiers;
    final nearest = nearestAnchor(widget.anchors, _ownGrams);
    final nearestTier = tiers[widget.anchors.indexWhere(
      (a) => a.tier == nearest.tier,
    )];
    // Tallest glyph in column widths — pins the band so the sheet doesn't
    // change height between a flat platter and an upright cup.
    final tallest = [
      for (final (i, tier) in tiers.indexed) ratios[i] / tier.asset.aspect,
    ].reduce(math.max);

    return Column(
      children: [
        PortionReadout(grams: _ownGrams, kcal: widget.kcal),
        const SizedBox(height: NhamSpacing.sp3),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 360),
          child: Semantics(
            slider: true,
            label: widget.sliderLabel,
            value: '$_ownGrams g — ${nearest.label} (${nearestTier.sizeLabel})',
            increasedValue: '${_gramsAfter(1)} g',
            decreasedValue: '${_gramsAfter(-1)} g',
            onIncrease: () => _emit(_gramsAfter(1)),
            onDecrease: () => _emit(_gramsAfter(-1)),
            child: PortionRulerStrip(
              majors: anchorPositions(widget.anchors.length),
              position: _scale.toPosition(_ownGrams) / positionMax,
              graduations: portionGraduationCount(widget.anchors.length),
              glyphBandAspect: 1 / tallest,
              glyphBuilder: (index, column) => PortionVesselGlyph(
                asset: tiers[index].asset,
                width: column * ratios[index],
                label: '${widget.anchors[index].label} '
                    '(${tiers[index].sizeLabel})',
                selected: widget.anchors[index].tier == nearest.tier,
                onTap: () {
                  HapticFeedback.selectionClick();
                  _emit(widget.anchors[index].value.round());
                },
              ),
              labelFor: (index) => tiers[index].sizeLabel,
              onChanged: (fraction) =>
                  _emit(_scale.toGrams(fraction * positionMax)),
            ),
          ),
        ),
        const SizedBox(height: NhamSpacing.sp2),
        Text(
          '${nearest.label} · ${nearestTier.sizeLabel}',
          textAlign: TextAlign.center,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: dashMeta(),
        ),
      ],
    );
  }

  int _gramsAfter(int direction) {
    final step = positionMax / portionGraduationCount(widget.anchors.length);
    return _scale.toGrams(
      (_scale.toPosition(_ownGrams) + direction * step)
          .clamp(0.0, positionMax.toDouble()),
    );
  }
}
