import 'dart:math' as math;
import 'dart:ui';

import '../../shared/widgets/brand/wordmark_glyphs.dart';
import 'spring_math.dart';
import 'wordmark_stage.dart';

/// Clack, the launch choreography: the K backs up to the left to make room,
/// and "allo" rolls in from the right as a spaced-out little train that brakes
/// against it. Each car clacks into the one ahead, squashes, rebounds, and
/// shoves the coupled chain in front of it, the K included.
///
/// Every time here is in milliseconds after the launch hold (see
/// `LaunchTimeline.hold`), and every distance is in wordmark units.
abstract final class ClackIntro {
  /// How long the letters move. Everything is at rest after this.
  static const double duration = 990;

  /// The K's starting offset: the one that puts its centre on the stage
  /// focus, which is the middle of the screen, where the launch image sits.
  static final double kStart =
      WordmarkStage.restFocus.dx -
      WordmarkGlyphs.bounds[WordmarkGlyph.k]!.center.dx;

  static const double _kTravel = 420;
  static const double _firstArrival = 470;
  static const double _carGap = 62;

  /// Train speed on a phone, in units per ms (about 550pt/s).
  static const double _cruise = 5.4;

  /// How hard a car presses into the one ahead is set by [_cruise], not by
  /// the train's actual speed, so a tablet's faster train lands the same.
  static const double _impactHz = 6;
  static const double _impactDamping = 0.42;
  static const double _maxSquash = 0.2;

  /// Speed lean: a letter in motion leans its top forward, this much shear
  /// per unit/ms of speed, up to [_maxLean].
  static const double _leanPerSpeed = 0.008;
  static const double _maxLean = 0.22;

  /// The train's speed on [screen]: fast enough that the a starts past the
  /// right edge of any screen, and never slower than a phone's.
  static double trainSpeed(WordmarkStage stage, Size screen) {
    final aLeft = WordmarkGlyphs.bounds[WordmarkGlyph.a]!.left;
    // 120 units of margin: the speed lean tips a fast car's top forward by up
    // to about a tenth of its height, and that corner must start off screen
    // too.
    final offRight =
        (screen.width - stage.anchor.dx) / stage.scale +
        stage.focus.dx -
        aLeft +
        120;
    return math.max(_cruise, offRight / _firstArrival);
  }

  /// Where [glyph] is [t] ms after the hold, on a train running at [speed]
  /// (from [trainSpeed]).
  static GlyphPose pose(WordmarkGlyph glyph, double t, double speed) {
    final now = _pose(glyph, t, speed);
    final velocity = (now.dx - _pose(glyph, t - 8, speed).dx) / 8;
    final lean = (-_leanPerSpeed * velocity).clamp(-_maxLean, _maxLean);
    return now.copyWith(skew: now.skew + lean);
  }

  /// While the app is still loading, the cars bump again from the back of
  /// the train to the front, every 1.2 s. [t] counts from the start of the
  /// wait; the result is added to the letter's `dx`.
  static double idleNudge(WordmarkGlyph glyph, double t) {
    final cycle = t % 1200;
    final fromTheBack = WordmarkGlyph.values.length - 1 - glyph.index;
    return -26 * springKick(cycle - fromTheBack * 55.0, 6, 0.38);
  }

  static GlyphPose _pose(WordmarkGlyph glyph, double t, double speed) {
    final index = glyph.index;
    var dx = 0.0, scaleX = 1.0, scaleY = 1.0, skew = 0.0;
    var pinned = false;

    if (glyph == WordmarkGlyph.k) {
      dx = kStart * (1 - easeInOutCubic(interval(t, 0, _kTravel)));
    } else {
      final sinceContact = t - _arrival(index - 1);
      if (sinceContact < 0) {
        dx = speed * -sinceContact;
      } else {
        // Negative: pressing into the car ahead, so squash against it rather
        // than overlap it. Positive: the rebound, a small hop back.
        final press =
            -impactDisplacement(
              sinceContact,
              _cruise,
              _impactHz,
              _impactDamping,
            );
        if (press < 0) {
          final width = WordmarkGlyphs.bounds[glyph]!.width;
          final squash = math.max(-_maxSquash, 0.55 * press / width);
          pinned = true;
          scaleX = 1 + squash;
          scaleY = 1 - 0.35 * squash;
        } else {
          dx = press;
        }
        skew = 0.1 * springKick(sinceContact, 5, 0.35);
      }
    }

    // Each arrival shoves the coupled chain ahead of it, the arriving car
    // included, so the chain moves as one.
    for (var car = math.max(0, index - 1); car < 4; car++) {
      dx -= (car == 0 ? 34 : 16) * springKick(t - _arrival(car), 6, 0.38);
    }

    return GlyphPose(
      dx: dx,
      scaleX: scaleX,
      scaleY: scaleY,
      skew: skew,
      pinLeadingEdge: pinned,
    );
  }

  /// When car [car] (0 is the a) meets the one ahead of it.
  static double _arrival(int car) => _firstArrival + _carGap * car;
}
