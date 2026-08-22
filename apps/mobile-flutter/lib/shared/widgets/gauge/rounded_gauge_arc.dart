/// The dial itself: a 240° rounded arc that fills with what has been used.
///
/// Draws only the arc; [GaugeDial] is what callers want, and owns the figures
/// that sit in its mouth.
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

/// How tall the dial draws at [outerRadius]: the top half, the drop to the
/// tips, and the rounded cap that hangs below them.
double gaugeHeight(double outerRadius) =>
    outerRadius + gaugeTipOffset(outerRadius) + outerRadius / 8;

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
  // The app's signature sweep — the same curve the day pager, the timeline
  // picker and the feed's scroll animate on.
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
