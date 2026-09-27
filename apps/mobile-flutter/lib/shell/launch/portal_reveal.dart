import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/foundation.dart';

import 'spring_math.dart';
import 'wordmark_stage.dart';

/// One moment of the reveal: the stage it runs on and how far each of its
/// layers has gone.
@immutable
class RevealState {
  const RevealState({
    required this.stage,
    this.holeOpen = 0,
    this.oPaper = 0,
    this.lettersOpacity = 1,
    this.oOpacity = 1,
    this.curtainOpacity = 1,
  });

  final WordmarkStage stage;

  /// How far the o's hole has opened into a window onto the app: 0 is filled
  /// with the canvas, 1 is clear.
  final double holeOpen;

  /// The o's ring, from ink (0) to the canvas colour (1).
  final double oPaper;

  /// K, a and the two l's.
  final double lettersOpacity;
  final double oOpacity;
  final double curtainOpacity;
}

/// Through the o, the launch reveal: the o's hole opens into a window onto
/// the app, the ring turns to paper, and the camera flies through it while
/// K-a-l-l fly off and fade. What reads is an iris opening in the page.
///
/// The ring turns to paper before the zoom takes off because a black ring
/// grown to a screen's width reads as a dark flash sweeping over the app.
abstract final class PortalReveal {
  static const double duration = 680;

  /// Centre of the o's hole, in wordmark units: the zoom's fixed point.
  static const Offset _counterCentre = Offset(1884, 526);

  /// Half the hole's narrower span (it is 236 units wide, 256 tall).
  static const double _counterRadius = 118;

  /// [t] ms into the reveal, from the resting [stage] on [screen].
  static RevealState at(double t, WordmarkStage stage, Size screen) {
    final zoom = math.exp(
      math.log(_zoomToClear(stage, screen)) *
          easeInCubic(interval(t, 120, 520)),
    );
    final curtain = 1 - interval(t, 580, 100);
    return RevealState(
      stage: WordmarkStage(
        anchor: stage.toScreen(_counterCentre),
        focus: _counterCentre,
        scale: stage.scale * zoom,
      ),
      holeOpen: easeOutCubic(interval(t, 0, 200)),
      oPaper: easeInOutCubic(interval(t, 150, 230)),
      lettersOpacity: 1 - easeInQuad(interval(t, 220, 220)),
      oOpacity: curtain,
      curtainOpacity: curtain,
    );
  }

  /// The zoom at which the hole covers [screen] out to its farthest corner,
  /// with a margin. About 46 on a phone; more on a tablet.
  static double _zoomToClear(WordmarkStage stage, Size screen) {
    final centre = stage.toScreen(_counterCentre);
    final corners = [
      Offset.zero,
      Offset(screen.width, 0),
      Offset(0, screen.height),
      Offset(screen.width, screen.height),
    ];
    final farthest = corners.map((c) => (c - centre).distance).reduce(math.max);
    return farthest / (_counterRadius * stage.scale) * 1.1;
  }
}
