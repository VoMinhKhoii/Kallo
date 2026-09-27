import 'package:flutter/widgets.dart';

import '../../shared/widgets/brand/wordmark_glyphs.dart';
import '../../theme/kallo_colors.dart';
import 'launch_timeline.dart';
import 'portal_reveal.dart';
import 'rise_intro.dart';
import 'wordmark_stage.dart';

/// Paints the launch curtain from its [clock]: the canvas (holed by the o
/// once the reveal opens it into a window) and the wordmark, letter by letter.
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
    final stage = reveal.stage;
    final oTransform = stage.transformFor(
      WordmarkGlyph.o,
      frame.poseOf(WordmarkGlyph.o),
    );
    _paintCurtain(canvas, Offset.zero & size, reveal, oTransform);

    canvas.save();
    final slot = frame.slot;
    if (slot != null) {
      // The letters rise out of this line: nothing below it shows.
      final line = stage.toScreen(Offset(0, slot)).dy;
      canvas.clipRect(Rect.fromLTRB(0, 0, size.width, line));
    }
    for (final glyph in WordmarkGlyph.values) {
      final isO = glyph == WordmarkGlyph.o;
      final opacity = isO ? reveal.oOpacity : reveal.lettersOpacity;
      if (opacity <= 0) continue;
      final ink =
          isO
              ? Color.lerp(
                KalloColors.text,
                KalloColors.surface,
                reveal.oPaper,
              )!
              : KalloColors.text;
      _paintGlyph(
        canvas,
        glyph,
        isO ? oTransform : stage.transformFor(glyph, frame.poseOf(glyph)),
        ink.withValues(alpha: opacity),
      );
    }
    if (frame.ghostK > 0) {
      _paintGlyph(
        canvas,
        WordmarkGlyph.k,
        stage.transformFor(WordmarkGlyph.k, GlyphPose(dx: RiseIntro.kStart)),
        KalloColors.text.withValues(alpha: frame.ghostK),
      );
    }
    canvas.restore();
  }

  /// The canvas colour over the whole screen, less the o's hole as far as
  /// the reveal has opened it.
  void _paintCurtain(
    Canvas canvas,
    Rect screen,
    RevealState reveal,
    Matrix4 oTransform,
  ) {
    if (reveal.curtainOpacity <= 0) return;
    final paint =
        Paint()
          ..color = KalloColors.surface.withValues(
            alpha: reveal.curtainOpacity,
          );
    if (reveal.holeOpen <= 0) {
      canvas.drawRect(screen, paint);
      return;
    }
    final hole = WordmarkGlyphs.counter.transform(oTransform.storage);
    canvas.drawPath(
      Path()
        ..fillType = PathFillType.evenOdd
        ..addRect(screen)
        ..addPath(hole, Offset.zero),
      paint,
    );
    // The part of the window not open yet.
    if (reveal.holeOpen < 1) {
      final closed = reveal.curtainOpacity * (1 - reveal.holeOpen);
      canvas.drawPath(
        hole,
        Paint()..color = KalloColors.surface.withValues(alpha: closed),
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
