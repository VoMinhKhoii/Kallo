import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/foundation.dart';

import '../../shared/widgets/brand/wordmark_glyphs.dart';
import 'portal_reveal.dart';
import 'rise_intro.dart';
import 'spring_math.dart';
import 'wordmark_stage.dart';

/// Everything the painter needs to draw one frame of the launch curtain.
@immutable
class LaunchFrame {
  const LaunchFrame({
    required this.reveal,
    this.poses = const {},
    this.slot,
    this.ghostK = 0,
  });

  /// The stage and how far each layer has gone; untouched before the reveal.
  final RevealState reveal;

  /// Letters left out are at rest.
  final Map<WordmarkGlyph, GlyphPose> poses;

  /// While the letters rise: the line (in wordmark units) nothing is drawn
  /// below, so they come up out of it.
  final double? slot;

  /// Reduced motion only: the K still centred where the launch screen drew
  /// it, crossfading out as the assembled wordmark fades in.
  final double ghostK;

  GlyphPose poseOf(WordmarkGlyph glyph) => poses[glyph] ?? GlyphPose.rest;
}

/// The curtain's time source: milliseconds since its first frame, and the
/// moment the app underneath became ready. Notifies on every tick.
class LaunchClock extends ChangeNotifier {
  double _elapsed = 0;
  double? _readyAt;

  double get elapsed => _elapsed;
  double? get readyAt => _readyAt;

  void tick(double elapsed) {
    _elapsed = elapsed;
    notifyListeners();
  }

  /// Records the first moment the app was ready. Later calls are no-ops.
  void markReady() {
    if (_readyAt != null) return;
    _readyAt = _elapsed;
    notifyListeners();
  }
}

/// The launch intro's phases as a pure function of time, in milliseconds
/// since the curtain's first frame:
///
///   hold → intro → wait (only if the app is not ready yet) → reveal → done.
///
/// The intro always plays in full, and the reveal never starts before the
/// app is ready: the curtain spends load time rather than adding to it, and
/// never lifts onto a half-built screen.
@immutable
class LaunchTimeline {
  const LaunchTimeline({this.reduceMotion = false});

  final bool reduceMotion;

  /// The K holds still this long first. iOS spends 200ms fading its launch
  /// screen off the first Flutter frame, and a K moving under that fade would
  /// show twice.
  static const double hold = 260;

  /// Reduced motion: the K crossfades into the wordmark over this long.
  static const double _crossfade = 320;

  /// The wait's blinking starts this long after the intro ends, and bleeds
  /// out over the first [_idleFadeOut] of the reveal.
  static const double _idleDelay = 400;
  static const double _idleFadeOut = 180;

  double get introEnd =>
      hold + (reduceMotion ? _crossfade : RiseIntro.duration);

  double get revealDuration => reduceMotion ? 360 : PortalReveal.duration;

  /// When the reveal begins, or null while the app is not ready.
  double? revealStart(double? readyAt) =>
      readyAt == null ? null : math.max(introEnd, readyAt);

  bool isDone(double t, double? readyAt) {
    final start = revealStart(readyAt);
    return start != null && t >= start + revealDuration;
  }

  LaunchFrame frameAt(
    double t, {
    required double? readyAt,
    required Size screen,
  }) {
    final rest = WordmarkStage.rest(screen);
    final start = revealStart(readyAt);
    // Negative until the reveal begins, so every window over it reads 0.
    final sinceReveal = start == null ? -1.0 : t - start;
    if (reduceMotion) return _reduced(t, sinceReveal, rest);

    final idleT = t - introEnd - _idleDelay;
    final waiting = idleT > 0 && (readyAt == null || readyAt > introEnd);
    final idle =
        waiting
            ? 1 - easeOutCubic(interval(sinceReveal, 0, _idleFadeOut))
            : 0.0;

    final poses = {
      for (final glyph in WordmarkGlyph.values)
        glyph: RiseIntro.pose(glyph, t - hold),
    };
    final blink = idle * RiseIntro.idleBlink(idleT);
    if (blink > 0) {
      poses[WordmarkGlyph.o] = RiseIntro.winking(
        poses[WordmarkGlyph.o]!,
        blink,
      );
    }

    return LaunchFrame(
      reveal:
          sinceReveal >= 0
              ? PortalReveal.at(sinceReveal, rest, screen)
              : RevealState(stage: rest),
      poses: poses,
      slot: t < introEnd ? RiseIntro.slot : null,
    );
  }

  /// No travel at all: the centred K crossfades into the assembled wordmark,
  /// and the reveal is a plain fade.
  LaunchFrame _reduced(double t, double sinceReveal, WordmarkStage rest) {
    final word = interval(t, hold, _crossfade);
    final leaving = 1 - easeInOutCubic(interval(sinceReveal, 0, 280));
    return LaunchFrame(
      reveal: RevealState(
        stage: rest,
        lettersOpacity: word * leaving,
        oOpacity: word * leaving,
        curtainOpacity: 1 - easeInOutCubic(interval(sinceReveal, 60, 300)),
      ),
      ghostK: (1 - word) * leaving,
    );
  }

  @override
  bool operator ==(Object other) =>
      other is LaunchTimeline && other.reduceMotion == reduceMotion;

  @override
  int get hashCode => reduceMotion.hashCode;
}
