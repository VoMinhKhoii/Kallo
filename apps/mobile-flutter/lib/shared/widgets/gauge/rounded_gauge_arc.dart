/// The dial itself: a 240° rounded arc that fills with what has been used.
///
/// Draws only the arc. The figures that sit in its mouth are the caller's, laid
/// out against [gaugeTipOffset] so the readout and the dial share a line — see
/// [readoutTopFor], which every dial in the app positions its text with.
///
/// The sweep FILLS with consumption, matching the week strip, the heatmap and
/// the nutrition page. A cutting user's headline figure counts down while this
/// counts up: the number answers "how much is left", the dial answers "how far
/// through the day am I", and the two are complements. Draining it for cutters
/// was considered and dropped — it would have made "exactly on target" and
/// "800 over" render identically, since both would show an empty dial.
library;

import 'package:flutter/material.dart';

import '../../../theme/calm_tokens.dart';
import 'gauge_arc_geometry.dart';

/// The gap between the readout's stacked lines.
const double kGaugeReadoutGap = 2;

/// A line's laid-out height at the viewer's text scale.
double gaugeLineHeight(TextStyle style, TextScaler scaler) =>
    scaler.scale(style.fontSize!) * (style.height ?? 1);

/// How tall the dial draws at [outerRadius]: the top half, the drop to the
/// tips, and the rounded cap that hangs below them.
double gaugeHeight(double outerRadius) =>
    outerRadius + gaugeTipOffset(outerRadius) + outerRadius / 8;

/// Where a readout must start for its SECOND line to sit centred on the dial's
/// tips — the alignment every dial shares, so type and arc read as one object.
///
/// Computed rather than hard-coded because the lines grow with the viewer's
/// text scale, and a fixed offset would drift off the tips at 1.3.
double readoutTopFor({
  required double outerRadius,
  required double primaryHeight,
  required double secondaryHeight,
}) =>
    outerRadius +
    gaugeTipOffset(outerRadius) -
    secondaryHeight / 2 -
    kGaugeReadoutGap -
    primaryHeight;

class RoundedGaugeArc extends StatefulWidget {
  const RoundedGaugeArc({
    required this.progress,
    required this.outerRadius,
    required this.fill,
    this.track = kTrack,
    super.key,
  });

  /// Consumed ÷ target. Over 1 the dial simply reads full.
  final double progress;
  final double outerRadius;
  final Color fill;
  final Color track;

  @override
  State<RoundedGaugeArc> createState() => _RoundedGaugeArcState();
}

class _RoundedGaugeArcState extends State<RoundedGaugeArc>
    with SingleTickerProviderStateMixin {
  // The app's signature sweep, shared with CalorieRing.
  static const Curve _curve = Cubic(0.16, 1, 0.3, 1);

  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1000),
  );
  late Animation<double> _sweep = _build();

  Animation<double> _build() => Tween<double>(
    begin: 0,
    end: widget.progress,
  ).animate(CurvedAnimation(parent: _controller, curve: _curve));

  @override
  void initState() {
    super.initState();
    _controller.forward();
  }

  @override
  void didUpdateWidget(RoundedGaugeArc old) {
    super.didUpdateWidget(old);
    if (old.progress != widget.progress) {
      _sweep = _build();
      _controller
        ..reset()
        ..forward();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    return AnimatedBuilder(
      animation: _sweep,
      builder: (context, _) => CustomPaint(
        size: Size(
          widget.outerRadius * 2,
          gaugeHeight(widget.outerRadius),
        ),
        painter: _GaugePainter(
          progress: reduceMotion ? widget.progress : _sweep.value,
          outerRadius: widget.outerRadius,
          fill: widget.fill,
          track: widget.track,
        ),
      ),
    );
  }
}

class _GaugePainter extends CustomPainter {
  const _GaugePainter({
    required this.progress,
    required this.outerRadius,
    required this.fill,
    required this.track,
  });

  final double progress;
  final double outerRadius;
  final Color fill;
  final Color track;

  @override
  void paint(Canvas canvas, Size size) {
    // The arc's top touches the top of the box: no dead space above it, which
    // is what keeps a dial and the label above it reading as one thing.
    final paths = gaugePaths(
      center: Offset(size.width / 2, outerRadius),
      outerRadius: outerRadius,
      progress: progress,
    );
    final paint = Paint()..isAntiAlias = true;
    canvas
      ..drawPath(paths.remainder, paint..color = track)
      ..drawPath(paths.filled, paint..color = fill);
  }

  @override
  bool shouldRepaint(_GaugePainter old) =>
      old.progress != progress ||
      old.outerRadius != outerRadius ||
      old.fill != fill ||
      old.track != track;
}
