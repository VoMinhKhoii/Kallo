import 'package:flutter/widgets.dart';

import '../../shared/widgets/brand/wordmark_glyphs.dart';
import '../../theme/kallo_colors.dart';
import 'clack_intro.dart';
import 'launch_timeline.dart';
import 'wordmark_stage.dart';

/// Paints the launch curtain from its [clock]: the canvas, and the wordmark
/// letter by letter.
///
/// Drawn from [Path]s rather than an `SvgPicture` because the very first
/// frame must already carry the K: flutter_svg loads its picture on a
/// background isolate and paints nothing on the frame it is built.
class LaunchPainter extends CustomPainter {
  LaunchPainter({required this.clock, required this.timeline})
    : super(repaint: clock);

  final LaunchClock clock;
  final LaunchTimeline timeline;

  @override
  void paint(Canvas canvas, Size size) {
    final frame = timeline.frameAt(
      clock.elapsed,
      readyAt: clock.readyAt,
      screen: size,
    );
    final reveal = frame.reveal;
    if (reveal.curtainOpacity > 0) {
      canvas.drawRect(
        Offset.zero & size,
        Paint()
          ..color = KalloColors.surface.withValues(
            alpha: reveal.curtainOpacity,
          ),
      );
    }
    if (reveal.wordOpacity > 0) {
      final ink = KalloColors.text.withValues(alpha: reveal.wordOpacity);
      for (final glyph in WordmarkGlyph.values) {
        _paintGlyph(
          canvas,
          glyph,
          reveal.stage.transformFor(glyph, frame.poseOf(glyph)),
          ink,
        );
      }
    }
    if (frame.ghostK > 0) {
      _paintGlyph(
        canvas,
        WordmarkGlyph.k,
        reveal.stage.transformFor(
          WordmarkGlyph.k,
          GlyphPose(dx: ClackIntro.kStart),
        ),
        KalloColors.text.withValues(alpha: frame.ghostK),
      );
    }
  }

  static void _paintGlyph(
    Canvas canvas,
    WordmarkGlyph glyph,
    Matrix4 transform,
    Color color,
  ) {
    canvas.save();
    canvas.transform(transform.storage);
    canvas.drawPath(WordmarkGlyphs.pathOf(glyph), Paint()..color = color);
    canvas.restore();
  }

  @override
  bool shouldRepaint(LaunchPainter oldDelegate) =>
      oldDelegate.clock != clock || oldDelegate.timeline != timeline;
}
