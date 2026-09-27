import 'dart:ui';

import 'package:flutter/foundation.dart';

import 'spring_math.dart';
import 'wordmark_stage.dart';

/// One moment of the reveal: the stage the word sits on and how opaque the
/// word and the curtain behind it still are.
@immutable
class RevealState {
  const RevealState({
    required this.stage,
    this.wordOpacity = 1,
    this.curtainOpacity = 1,
  });

  final WordmarkStage stage;
  final double wordOpacity;
  final double curtainOpacity;
}

/// Lift & fade, the launch reveal: the word lifts a few points and fades,
/// and the canvas clears a beat behind it onto the app.
abstract final class LiftReveal {
  static const double duration = 420;

  /// How far the word rises as it goes, in points.
  static const double _lift = 16;

  /// [t] ms into the reveal, from the resting [stage].
  static RevealState at(double t, WordmarkStage stage) {
    final going = easeInQuad(interval(t, 0, 300));
    return RevealState(
      stage: stage.shifted(Offset(0, -_lift * going)),
      wordOpacity: 1 - going,
      curtainOpacity: 1 - easeInOutCubic(interval(t, 80, 320)),
    );
  }
}
