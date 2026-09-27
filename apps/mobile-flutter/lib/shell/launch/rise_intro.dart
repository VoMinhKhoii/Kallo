import '../../shared/widgets/brand/wordmark_glyphs.dart';
import 'spring_math.dart';
import 'wordmark_stage.dart';

/// Rise, the launch choreography. The K glides left from the middle of the
/// screen and brings the word with it, while a-l-l-o rise out of an invisible
/// line in its wake, each with a small bounce. Once they settle, the o winks.
///
/// Clean by construction: the word moves as one frame, each letter only ever
/// travels straight up into its own slot, and the play is spent in one place
/// (the wink). Every time here is in ms after the launch hold
/// (`LaunchTimeline.hold`), and every distance is in wordmark units.
abstract final class RiseIntro {
  /// Everything is at rest, the wink included, this long after the hold.
  static const double duration = 920;

  /// The line the letters rise out of: just under the lowest ink at rest
  /// (the o's overshoot, 792), so a resting letter is never cut.
  static const double slot = 800;

  /// The K's starting offset: the one that puts its centre on the stage
  /// focus, which is the middle of the screen, where the launch image sits.
  static final double kStart =
      WordmarkStage.restFocus.dx -
      WordmarkGlyphs.bounds[WordmarkGlyph.k]!.center.dx;

  /// When each letter starts up out of the slot.
  static const Map<WordmarkGlyph, double> _riseAt = {
    WordmarkGlyph.a: 60,
    WordmarkGlyph.l1: 110,
    WordmarkGlyph.l2: 160,
    WordmarkGlyph.o: 230,
  };

  /// A beat after the o settles.
  static const double _winkAt = 700;

  /// Where [glyph] is [t] ms after the hold.
  static GlyphPose pose(WordmarkGlyph glyph, double t) {
    // The whole word glides as one, with a hair of overshoot.
    final dx = kStart * (1 - springStep(t, 1.5, 0.78));
    if (glyph == WordmarkGlyph.k) return GlyphPose(dx: dx);

    final start = _riseAt[glyph]!;
    // Deep enough that the letter starts wholly below the slot.
    final depth = slot + 24 - WordmarkGlyphs.bounds[glyph]!.top;
    double risen(double at) => springStep(at - start, 2.6, 0.62);
    final dy = depth * (1 - risen(t));

    final shut = glyph == WordmarkGlyph.o ? blink(t - _winkAt) : 0.0;
    if (shut > 0) return winking(GlyphPose(dx: dx, dy: dy), shut);

    // Stretches a little while it moves fast: units per ms, upward.
    final speed = depth * (risen(t) - risen(t - 8)) / 8;
    final stretch = (0.008 * speed).clamp(-0.05, 0.07).toDouble();
    return GlyphPose(
      dx: dx,
      dy: dy,
      scaleX: 1 - 0.4 * stretch,
      scaleY: 1 + stretch,
    );
  }

  /// While the app is still loading, the o blinks every 1.7 s. [t] counts
  /// from the start of the wait.
  static double idleBlink(double t) => blink(t % 1700);

  /// [pose] with its eye [shut] of the way closed: squashed towards its own
  /// middle, a touch wider as it shuts.
  static GlyphPose winking(GlyphPose pose, double shut) => GlyphPose(
    dx: pose.dx,
    dy: pose.dy,
    scaleX: 1 + 0.08 * shut,
    scaleY: 1 - 0.88 * shut,
    aboutCentre: true,
  );

  /// A blink, [t] ms in: 0 (open) → 1 (shut) → 0 over 200 ms, shutting
  /// faster than it opens.
  static double blink(double t) {
    if (t <= 0 || t >= 200) return 0;
    return t < 70 ? easeInQuad(t / 70) : 1 - easeOutCubic((t - 70) / 130);
  }
}
