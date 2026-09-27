import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shared/widgets/brand/wordmark_glyphs.dart';
import 'package:kallo_mobile/shell/launch/clack_intro.dart';
import 'package:kallo_mobile/shell/launch/wordmark_stage.dart';

const _phone = Size(393, 852);
final _stage = WordmarkStage.rest(_phone);
final _speed = ClackIntro.trainSpeed(_stage, _phone);

/// Where [glyph]'s ink box lands on [stage] in [pose].
Rect _onScreen(WordmarkGlyph glyph, GlyphPose pose, [WordmarkStage? stage]) =>
    MatrixUtils.transformRect(
      (stage ?? _stage).transformFor(glyph, pose),
      WordmarkGlyphs.bounds[glyph]!,
    );

GlyphPose _at(WordmarkGlyph glyph, double t) =>
    ClackIntro.pose(glyph, t, _speed);

void main() {
  test('the K starts exactly where the native launch screen draws it', () {
    // gen-splash-mark.mjs: the mark 72pt tall, 656:708, centred on the screen.
    final k = _onScreen(WordmarkGlyph.k, _at(WordmarkGlyph.k, 0));

    expect(k.height, closeTo(WordmarkStage.launchMarkHeight, 1e-9));
    expect(k.width, closeTo(72 * 656 / 708, 1e-9));
    expect(k.center.dx, closeTo(_phone.width / 2, 1e-9));
    expect(k.center.dy, closeTo(_phone.height / 2, 1e-9));
  });

  for (final (name, screen) in [
    ('a phone', _phone),
    ('a phone on its side', const Size(852, 393)),
    ('an iPad', const Size(1024, 1366)),
  ]) {
    test('every other letter starts past the right edge of $name', () {
      final stage = WordmarkStage.rest(screen);
      final speed = ClackIntro.trainSpeed(stage, screen);
      for (final glyph in WordmarkGlyph.values.skip(1)) {
        final start = _onScreen(glyph, ClackIntro.pose(glyph, 0, speed), stage);
        expect(start.left, greaterThan(screen.width), reason: '$glyph');
      }
    });
  }

  test('the word is assembled and centred once the intro is over', () {
    for (final glyph in WordmarkGlyph.values) {
      final end = _onScreen(glyph, _at(glyph, ClackIntro.duration));
      final rest = _onScreen(glyph, GlyphPose.rest);
      // The springs are still ringing by a hair; nothing visible.
      expect(end.left, closeTo(rest.left, 0.25), reason: '$glyph');
      expect(end.width, closeTo(rest.width, 0.25), reason: '$glyph');
    }
    final word =
        _onScreen(WordmarkGlyph.k, GlyphPose.rest).left +
        _onScreen(WordmarkGlyph.o, GlyphPose.rest).right;
    expect(word / 2, closeTo(_phone.width / 2, 1e-9));
  });

  test('the K travels straight left, never right of where it began', () {
    final start = _onScreen(WordmarkGlyph.k, _at(WordmarkGlyph.k, 0));
    for (var t = 0.0; t <= ClackIntro.duration; t += 4) {
      final k = _onScreen(WordmarkGlyph.k, _at(WordmarkGlyph.k, t));
      expect(k.bottom, closeTo(start.bottom, 1e-9));
      expect(k.center.dx, lessThanOrEqualTo(start.center.dx + 1e-9));
    }
  });

  test('the cars arrive in reading order, the a first', () {
    double arrives(WordmarkGlyph glyph) {
      for (var t = 0.0; t <= ClackIntro.duration; t += 1) {
        if (_at(glyph, t).pinLeadingEdge) return t;
      }
      fail('$glyph never arrived');
    }

    final times = [for (final g in WordmarkGlyph.values.skip(1)) arrives(g)];
    expect(times, orderedEquals([...times]..sort()));
  });

  test('a car squashes against the one ahead instead of running into it', () {
    // On the baseline, where the shear does not reach, no car ever comes
    // much closer to the one ahead than it rests. A car's rebound meets the
    // next car arriving, which closes a pair by up to ~2.6pt (measured); the
    // tightest moment still leaves ~2.3pt of air between the l and the o.
    double foot(WordmarkGlyph glyph, double t, {required bool leading}) {
      final box = WordmarkGlyphs.bounds[glyph]!;
      return MatrixUtils.transformPoint(
        _stage.transformFor(glyph, _at(glyph, t)),
        Offset(leading ? box.left : box.right, WordmarkGlyphs.baseline),
      ).dx;
    }

    double gap(WordmarkGlyph ahead, WordmarkGlyph car, double t) =>
        foot(car, t, leading: true) - foot(ahead, t, leading: false);
    for (var i = 1; i < WordmarkGlyph.values.length; i++) {
      final ahead = WordmarkGlyph.values[i - 1], car = WordmarkGlyph.values[i];
      final resting = gap(ahead, car, ClackIntro.duration * 4);
      for (var t = 0.0; t <= ClackIntro.duration; t += 2) {
        final now = gap(ahead, car, t);
        expect(now, greaterThan(resting - 3), reason: '$car at $t');
        if (resting > 0) expect(now, greaterThan(1), reason: '$car at $t');
      }
    }
  });

  test('the squash stays within a fifth of a letter', () {
    for (final glyph in WordmarkGlyph.values) {
      for (var t = 0.0; t <= ClackIntro.duration; t += 2) {
        expect(_at(glyph, t).scaleX, greaterThanOrEqualTo(0.8 - 1e-9));
      }
    }
  });
}
