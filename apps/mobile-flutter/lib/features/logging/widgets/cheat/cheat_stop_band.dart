import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../models/logging/cheat.dart';
import '../../../../theme/calm_tokens.dart';

const _labelWidth = 84.0;
const _minBandHeight = 42.0;
const _maxLines = 3;

TextStyle _labelStyle({required bool emphasized}) => dashMeta(
  color: emphasized ? kInk : kInkMuted,
).copyWith(height: 1.25, fontWeight: FontWeight.w400);

TextAlign _labelAlign(CheatSliderAnchor anchor) =>
    anchor.level <= 0
        ? TextAlign.left
        : anchor.level >= 10
        ? TextAlign.right
        : TextAlign.center;

/// One band of scenario stops above (`top`) or below the cheat slider's track:
/// every other stop, pinned at its point on the 0–10 scale and tappable to
/// jump there. The band is as tall as its tallest label (never under 42), so a
/// label that wraps to three lines stays inside the band instead of running
/// into the section title above or the next slider below.
class CheatStopBand extends StatelessWidget {
  const CheatStopBand({
    super.key,
    required this.stops,
    required this.top,
    required this.exactLevel,
    required this.betweenLow,
    required this.betweenHigh,
    required this.onSelect,
  });

  /// All six stops, sorted by level; the band keeps the even (top) or odd
  /// (bottom) ones.
  final List<CheatSliderAnchor> stops;
  final bool top;

  /// The stop the slider sits exactly on, or null between two stops.
  final int? exactLevel;

  /// The two stops bracketing an in-between level (-1 when on a stop).
  final int betweenLow;
  final int betweenHigh;
  final ValueChanged<double> onSelect;

  double _height(BuildContext context, List<CheatSliderAnchor> mine) {
    final style = DefaultTextStyle.of(
      context,
    ).style.merge(_labelStyle(emphasized: false));
    final scaler = MediaQuery.textScalerOf(context);
    final direction = Directionality.of(context);
    var tallest = _minBandHeight;
    for (final anchor in mine) {
      final painter = TextPainter(
        text: TextSpan(text: anchor.label, style: style),
        textAlign: _labelAlign(anchor),
        textDirection: direction,
        textScaler: scaler,
        maxLines: _maxLines,
        ellipsis: '…',
      )..layout(maxWidth: _labelWidth);
      tallest = math.max(tallest, painter.height);
      painter.dispose();
    }
    return tallest;
  }

  @override
  Widget build(BuildContext context) {
    final mine = [
      for (final (i, anchor) in stops.indexed)
        if ((i % 2 == 0) == top) anchor,
    ];
    return SizedBox(
      height: _height(context, mine),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final width = constraints.maxWidth;
          return Stack(
            clipBehavior: Clip.none,
            children: [
              for (final anchor in mine)
                _StopLabel(
                  anchor: anchor,
                  trackWidth: width,
                  top: top,
                  emphasized:
                      anchor.level.round() == exactLevel ||
                      anchor.level.round() == betweenLow ||
                      anchor.level.round() == betweenHigh,
                  onTap: () {
                    HapticFeedback.selectionClick();
                    onSelect(anchor.level);
                  },
                ),
            ],
          );
        },
      ),
    );
  }
}

/// A scenario label pinned at its point on the 0–10 scale. Edge stops align
/// outward; middle stops center on their position.
class _StopLabel extends StatelessWidget {
  const _StopLabel({
    required this.anchor,
    required this.trackWidth,
    required this.top,
    required this.emphasized,
    required this.onTap,
  });

  final CheatSliderAnchor anchor;
  final double trackWidth;
  final bool top;
  final bool emphasized;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final center = trackWidth * (anchor.level / 10);
    final left =
        anchor.level <= 0
            ? 0.0
            : anchor.level >= 10
            ? trackWidth - _labelWidth
            : (center - _labelWidth / 2).clamp(0.0, trackWidth - _labelWidth);

    return Positioned(
      left: left,
      top: top ? null : 0,
      bottom: top ? 0 : null,
      width: _labelWidth,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Text(
          anchor.label,
          maxLines: _maxLines,
          overflow: TextOverflow.ellipsis,
          textAlign: _labelAlign(anchor),
          style: _labelStyle(emphasized: emphasized),
        ),
      ),
    );
  }
}
