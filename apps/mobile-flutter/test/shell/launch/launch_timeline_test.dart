import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shared/widgets/brand/wordmark_glyphs.dart';
import 'package:kallo_mobile/shell/launch/launch_timeline.dart';
import 'package:kallo_mobile/shell/launch/lift_reveal.dart';

const _phone = Size(393, 852);
const _timeline = LaunchTimeline();

void main() {
  test('holds everything still while iOS fades its launch screen', () {
    final first = _timeline.frameAt(0, readyAt: 0, screen: _phone);
    for (var t = 0.0; t <= LaunchTimeline.hold; t += 10) {
      final frame = _timeline.frameAt(t, readyAt: 0, screen: _phone);
      // The K holds; the train has not come on screen yet.
      expect(
        frame.poseOf(WordmarkGlyph.k).dx,
        first.poseOf(WordmarkGlyph.k).dx,
      );
      for (final glyph in WordmarkGlyph.values.skip(1)) {
        final left =
            frame.reveal.stage
                .toScreen(
                  Offset(
                    WordmarkGlyphs.bounds[glyph]!.left + frame.poseOf(glyph).dx,
                    0,
                  ),
                )
                .dx;
        expect(left, greaterThan(_phone.width), reason: '$glyph at $t');
      }
    }
  });

  test('an app ready at once still gets the whole intro', () {
    final end = _timeline.introEnd;

    expect(_timeline.revealStart(0), end);
    expect(_timeline.isDone(end + LiftReveal.duration - 1, 0), isFalse);
    expect(_timeline.isDone(end + LiftReveal.duration, 0), isTrue);
  });

  test('never lifts off an app that is not ready, however long it takes', () {
    for (final t in <double>[0, 1500, 10000, 120000]) {
      expect(_timeline.isDone(t, null), isFalse);
      final frame = _timeline.frameAt(t, readyAt: null, screen: _phone);
      expect(frame.reveal.curtainOpacity, 1);
      expect(frame.reveal.wordOpacity, 1);
    }
  });

  test('a late app is revealed the moment it is ready', () {
    expect(_timeline.revealStart(3200), 3200);
    expect(_timeline.isDone(3200 + LiftReveal.duration, 3200), isTrue);
  });

  test(
    'the train bumps again while the app loads, never when it was ready',
    () {
      bool ripples(double? readyAt, double to) => [
        for (var t = _timeline.introEnd; t < to; t += 10)
          (_timeline
                      .frameAt(t, readyAt: readyAt, screen: _phone)
                      .poseOf(WordmarkGlyph.o)
                      .dx -
                  _timeline
                      .frameAt(t, readyAt: 0, screen: _phone)
                      .poseOf(WordmarkGlyph.o)
                      .dx)
              .abs(),
      ].any((d) => d > 5);

      expect(ripples(null, _timeline.introEnd + 3000), isTrue);
      expect(ripples(_timeline.introEnd, _timeline.introEnd + 3000), isFalse);
    },
  );

  test('the reveal leaves nothing on screen', () {
    final frame = _timeline.frameAt(
      _timeline.introEnd + LiftReveal.duration,
      readyAt: 0,
      screen: _phone,
    );

    expect(frame.reveal.curtainOpacity, 0);
    expect(frame.reveal.wordOpacity, 0);
  });

  test('the word lifts as it fades, never drops', () {
    final rest = _timeline.frameAt(
      _timeline.introEnd,
      readyAt: 0,
      screen: _phone,
    );
    var previous = rest.reveal.stage.anchor.dy;
    for (var t = 0.0; t <= LiftReveal.duration; t += 10) {
      final frame = _timeline.frameAt(
        _timeline.introEnd + t,
        readyAt: 0,
        screen: _phone,
      );
      expect(frame.reveal.stage.anchor.dy, lessThanOrEqualTo(previous));
      previous = frame.reveal.stage.anchor.dy;
    }
    expect(rest.reveal.stage.anchor.dy - previous, closeTo(16, 1e-9));
  });

  group('reduced motion', () {
    const reduced = LaunchTimeline(reduceMotion: true);

    test('never moves a letter: the K crossfades into the word', () {
      for (
        var t = 0.0;
        t < reduced.introEnd + reduced.revealDuration;
        t += 10
      ) {
        final frame = reduced.frameAt(t, readyAt: 0, screen: _phone);
        expect(frame.poses, isEmpty, reason: 'at $t ms');
      }
      final start = reduced.frameAt(0, readyAt: null, screen: _phone);
      final settled = reduced.frameAt(
        reduced.introEnd,
        readyAt: null,
        screen: _phone,
      );

      expect(start.ghostK, 1);
      expect(start.reveal.wordOpacity, 0);
      expect(settled.ghostK, 0);
      expect(settled.reveal.wordOpacity, 1);
    });

    test('fades out once the app is ready', () {
      final end = reduced.introEnd + reduced.revealDuration;
      final frame = reduced.frameAt(end, readyAt: 0, screen: _phone);

      expect(frame.reveal.curtainOpacity, 0);
      expect(reduced.isDone(end, 0), isTrue);
    });
  });
}
