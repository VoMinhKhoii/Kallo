import 'dart:ui';

import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shared/widgets/brand/wordmark_glyphs.dart';
import 'package:kallo_mobile/shell/launch/launch_timeline.dart';
import 'package:kallo_mobile/shell/launch/portal_reveal.dart';

const _phone = Size(393, 852);
const _timeline = LaunchTimeline();

void main() {
  test('holds everything still while iOS fades its launch screen', () {
    final first = _timeline.frameAt(0, readyAt: 0, screen: _phone);
    for (var t = 0.0; t <= LaunchTimeline.hold; t += 10) {
      final frame = _timeline.frameAt(t, readyAt: 0, screen: _phone);
      for (final glyph in WordmarkGlyph.values) {
        expect(frame.poseOf(glyph).dx, first.poseOf(glyph).dx);
        expect(frame.poseOf(glyph).dy, first.poseOf(glyph).dy);
      }
    }
  });

  test('an app ready at once still gets the whole intro', () {
    final end = _timeline.introEnd;

    expect(_timeline.revealStart(0), end);
    expect(_timeline.isDone(end + PortalReveal.duration - 1, 0), isFalse);
    expect(_timeline.isDone(end + PortalReveal.duration, 0), isTrue);
  });

  test('never lifts off an app that is not ready, however long it takes', () {
    for (final t in <double>[0, 1500, 10000, 120000]) {
      expect(_timeline.isDone(t, null), isFalse);
      final frame = _timeline.frameAt(t, readyAt: null, screen: _phone);
      expect(frame.reveal.curtainOpacity, 1);
      expect(frame.reveal.holeOpen, 0);
    }
  });

  test('a late app is revealed the moment it is ready', () {
    expect(_timeline.revealStart(3200), 3200);
    expect(_timeline.isDone(3200 + PortalReveal.duration, 3200), isTrue);
  });

  test('the o blinks while the app loads, never when it was ready in time', () {
    bool blinks(double? readyAt, double to) => [
      for (var t = _timeline.introEnd; t < to; t += 10)
        _timeline
            .frameAt(t, readyAt: readyAt, screen: _phone)
            .poseOf(WordmarkGlyph.o)
            .aboutCentre,
    ].contains(true);

    expect(blinks(null, _timeline.introEnd + 3000), isTrue);
    expect(blinks(0, _timeline.introEnd + PortalReveal.duration), isFalse);
  });

  test('the reveal leaves nothing on screen', () {
    final frame = _timeline.frameAt(
      _timeline.introEnd + PortalReveal.duration,
      readyAt: 0,
      screen: _phone,
    );

    expect(frame.reveal.curtainOpacity, 0);
    expect(frame.reveal.lettersOpacity, 0);
    expect(frame.reveal.oOpacity, 0);
  });

  for (final (name, screen) in [
    ('a phone', _phone),
    ('a phone on its side', const Size(852, 393)),
    ('an iPad', const Size(1024, 1366)),
  ]) {
    test("the o's window opens past every corner of $name", () {
      // Full zoom lands 640 ms in, before the curtain fades.
      final frame = _timeline.frameAt(
        _timeline.introEnd + 640,
        readyAt: 0,
        screen: screen,
      );
      final stage = frame.reveal.stage;
      final window = WordmarkGlyphs.counter.transform(
        stage
            .transformFor(WordmarkGlyph.o, frame.poseOf(WordmarkGlyph.o))
            .storage,
      );
      for (final corner in [
        Offset.zero,
        Offset(screen.width, 0),
        Offset(0, screen.height),
        Offset(screen.width, screen.height),
      ]) {
        expect(window.contains(corner), isTrue, reason: '$corner');
      }
    });
  }

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
      expect(start.reveal.lettersOpacity, 0);
      expect(settled.ghostK, 0);
      expect(settled.reveal.lettersOpacity, 1);
    });

    test('fades out once the app is ready', () {
      final end = reduced.introEnd + reduced.revealDuration;
      final frame = reduced.frameAt(end, readyAt: 0, screen: _phone);

      expect(frame.reveal.curtainOpacity, 0);
      expect(reduced.isDone(end, 0), isTrue);
    });
  });
}
