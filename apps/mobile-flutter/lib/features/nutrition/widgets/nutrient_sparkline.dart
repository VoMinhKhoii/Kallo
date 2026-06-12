import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';

import '../../../features/dashboard/widgets/dashboard_tokens.dart';
import '../../../theme/nham_colors.dart';

/// A 7/30/90-day coverage sparkline that degrades to discrete dots when the
/// window holds too few points to imply a continuous trend.
///
/// The nutrition overview ships window AVERAGES, not a per-day series — so this
/// renders the resolved data point(s) honestly in **point mode** (dots, the
/// `nutrition.trend.pointMode` copy was written for exactly this) rather than
/// fabricating a line across days we don't have. When a real per-day series is
/// wired (backend mapper work, out of scope here), pass >= [_lineThreshold]
/// points and it draws a continuous tan line instead.
class NutrientSparkline extends StatelessWidget {
  const NutrientSparkline({
    super.key,
    required this.points,
    required this.semanticLabel,
  });

  /// Normalized 0..1 sample values, oldest → newest. Empty renders the
  /// "no data point" rail.
  final List<double> points;
  final String semanticLabel;

  /// Below this many points a line would over-claim continuity → dots.
  static const int _lineThreshold = 4;

  @override
  Widget build(BuildContext context) {
    final lineMode = points.length >= _lineThreshold;
    final modeLine = lineMode
        ? tr('nutrition.trend.lineMode')
        : tr('nutrition.trend.pointMode');

    return Semantics(
      label: semanticLabel,
      image: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            height: 56,
            width: double.infinity,
            child: points.isEmpty
                ? _EmptyRail(label: tr('nutrition.trend.noDataPoint'))
                : CustomPaint(
                    painter: _SparkPainter(
                      points: points,
                      lineMode: lineMode,
                    ),
                  ),
          ),
          const SizedBox(height: 8),
          Text(modeLine, style: dashMeta(color: kInkDisabled)),
        ],
      ),
    );
  }
}

class _EmptyRail extends StatelessWidget {
  const _EmptyRail({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Text(label, style: dashMeta(color: kInkDisabled)),
    );
  }
}

class _SparkPainter extends CustomPainter {
  const _SparkPainter({required this.points, required this.lineMode});

  final List<double> points;
  final bool lineMode;

  @override
  void paint(Canvas canvas, Size size) {
    const pad = 6.0;
    final w = size.width - pad * 2;
    final h = size.height - pad * 2;

    Offset at(int i) {
      final x = points.length == 1
          ? size.width / 2
          : pad + w * (i / (points.length - 1));
      final y = pad + h * (1 - points[i].clamp(0.0, 1.0));
      return Offset(x, y);
    }

    // Baseline rail.
    final rail = Paint()
      ..color = kTrack
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(
      Offset(pad, size.height - pad),
      Offset(size.width - pad, size.height - pad),
      rail,
    );

    if (lineMode) {
      final line = Paint()
        ..color = NhamColors.accent
        ..strokeWidth = 2
        ..style = PaintingStyle.stroke
        ..strokeJoin = StrokeJoin.round
        ..strokeCap = StrokeCap.round;
      final path = Path()..moveTo(at(0).dx, at(0).dy);
      for (var i = 1; i < points.length; i++) {
        path.lineTo(at(i).dx, at(i).dy);
      }
      canvas.drawPath(path, line);
    }

    // Dots — always drawn (in line mode they mark the samples).
    final dot = Paint()..color = NhamColors.accent;
    for (var i = 0; i < points.length; i++) {
      canvas.drawCircle(at(i), lineMode ? 2.5 : 4, dot);
    }
  }

  @override
  bool shouldRepaint(covariant _SparkPainter old) =>
      old.points != points || old.lineMode != lineMode;
}
