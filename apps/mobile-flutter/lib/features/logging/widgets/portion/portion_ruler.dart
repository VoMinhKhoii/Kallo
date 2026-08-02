import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../models/vessel.dart';
import '../../../../theme/calm_tokens.dart';
import '../../../../theme/nham_theme.dart';
import '../../logic/portion/portion_anchors.dart';
import 'portion_glyph_row.dart';
import 'portion_slider.dart';

/// Integrated piece ruler: one continuous track with equal-spaced anchors. Each
/// anchor carries a bottom-aligned silhouette above the track, a 1px tick on
/// it, and a gram label below — all sharing one column.
///
/// The silhouettes sit in n equal columns rather than being absolutely
/// positioned, because n equal columns have their centres at exactly
/// `anchorPositions(n)`: the glyphs line up with the ticks and labels for free,
/// and a glyph physically cannot spill into its neighbour.
///
/// The slider runs in position space (0–[positionMax]); grams map to/from it
/// piecewise-linearly over (0, min) (anchor positions, anchor values) (100%,
/// max), so anchors sit at fixed positions while grams stay continuous between
/// them. Position is held here so a drag never snaps back through the lossy
/// grams round-trip; it resyncs whenever grams change from outside (e.g. an
/// anchor tap).
///
/// Ported from `components/logging/feed/meal-entry/portion/portion-ruler.tsx`.
class PortionRuler extends StatefulWidget {
  const PortionRuler({
    super.key,
    required this.anchors,
    required this.countPrefix,
    required this.claimedTier,
    required this.grams,
    required this.min,
    required this.max,
    required this.kind,
    required this.sliderLabel,
    required this.sliderValueText,
    required this.onChanged,
  });

  final List<PortionAnchor> anchors;

  /// `"N × "` prefix (blank for a single piece).
  final String countPrefix;

  /// Tier claimed by the claim band, or null when the portion is custom.
  final int? claimedTier;

  final int grams;
  final int min;
  final int max;
  final PieceKind kind;
  final String sliderLabel;
  final String sliderValueText;
  final ValueChanged<int> onChanged;

  @override
  State<PortionRuler> createState() => _PortionRulerState();
}

class _PortionRulerState extends State<PortionRuler> {
  late List<double> _breaks = positionBreaks(widget.anchors.length);
  late List<num> _gramBreaks = _buildGramBreaks();
  late double _position = _gramsToPosition(widget.grams);

  /// Mirrors the grams this widget last emitted, so an outside change (anchor
  /// tap, re-open) resyncs the held position but a drag does not.
  late int _ownGrams = widget.grams;

  List<num> _buildGramBreaks() => [
    widget.min,
    ...widget.anchors.map((a) => a.value),
    widget.max,
  ];

  int _positionToGrams(double value) =>
      interpolate(value, _breaks, _gramBreaks).round();

  double _gramsToPosition(int value) =>
      interpolate(value.toDouble(), _gramBreaks, _breaks);

  @override
  void didUpdateWidget(PortionRuler oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.anchors.length != widget.anchors.length ||
        oldWidget.min != widget.min ||
        oldWidget.max != widget.max) {
      _breaks = positionBreaks(widget.anchors.length);
      _gramBreaks = _buildGramBreaks();
      _ownGrams = widget.grams;
      _position = _gramsToPosition(widget.grams);
      return;
    }
    if (widget.grams != _ownGrams) {
      _ownGrams = widget.grams;
      _position = _gramsToPosition(widget.grams);
    }
  }

  void _handlePosition(double next) {
    final grams = _positionToGrams(next);
    setState(() {
      _position = next;
      _ownGrams = grams;
    });
    widget.onChanged(grams);
  }

  @override
  Widget build(BuildContext context) {
    final positions = anchorPositions(widget.anchors.length);
    // One arrow/step press moves at least 1 g in every segment: the step is the
    // flattest segment's position-per-gram slope, rounded up.
    final step = rulerStep(_gramBreaks, _breaks);

    return ConstrainedBox(
      // Capped and centred so the glyphs stay a sensible size on a wide sheet.
      // The cap is on the whole ruler, not just the glyph row, so the row keeps
      // sharing its width — and therefore its column centres — with the track.
      constraints: const BoxConstraints(maxWidth: 360),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: PortionSlider.trackInset,
            ),
            child: AspectRatio(
              aspectRatio: glyphRowAspect(widget.anchors.length),
              child: PortionGlyphRow(
                anchors: widget.anchors,
                kind: widget.kind,
                countPrefix: widget.countPrefix,
                claimedTier: widget.claimedTier,
                onPick: (grams) {
                  HapticFeedback.selectionClick();
                  setState(() {
                    _ownGrams = grams;
                    _position = _gramsToPosition(grams);
                  });
                  widget.onChanged(grams);
                },
              ),
            ),
          ),
          const SizedBox(height: NhamSpacing.sp1), // mb-1
          PortionSlider(
            value: _position,
            min: 0,
            max: positionMax.toDouble(),
            accent: false,
            ticks: positions,
            divisions: positionMax ~/ step,
            semanticLabel: widget.sliderLabel,
            semanticValue: widget.sliderValueText,
            onChanged: _handlePosition,
          ),
          const SizedBox(height: NhamSpacing.sp2), // mt-2
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: PortionSlider.trackInset,
            ),
            child: Row(
              children: [
                // Equal columns put each label's centre on its tick, the same
                // way the glyph row does — no absolute positioning needed.
                for (final anchor in widget.anchors)
                  Expanded(
                    child: Text(
                      '${anchor.value} g',
                      textAlign: TextAlign.center,
                      maxLines: 1,
                      style: dashMeta(tabular: true),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
