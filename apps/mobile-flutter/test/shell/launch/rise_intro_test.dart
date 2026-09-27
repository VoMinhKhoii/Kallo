import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shared/widgets/brand/wordmark_glyphs.dart';
import 'package:kallo_mobile/shell/launch/rise_intro.dart';
import 'package:kallo_mobile/shell/launch/wordmark_stage.dart';

const _phone = Size(393, 852);
final _stage = WordmarkStage.rest(_phone);

/// Where [glyph]'s ink lands on screen in [pose].
Rect _onScreen(WordmarkGlyph glyph, GlyphPose pose) =>
    MatrixUtils.transformRect(
      _stage.transformFor(glyph, pose),
      WordmarkGlyphs.bounds[glyph]!,
    );

const _letters = [
  WordmarkGlyph.a,
  WordmarkGlyph.l1,
  WordmarkGlyph.l2,
  WordmarkGlyph.o,
];

void main() {
  test('the K starts exactly where the native launch screen draws it', () {
    // gen-splash-mark.mjs: the mark 72pt tall, 656:708, centred on the screen.
    final k = _onScreen(WordmarkGlyph.k, RiseIntro.pose(WordmarkGlyph.k, 0));

    expect(k.height, closeTo(WordmarkStage.launchMarkHeight, 1e-9));
    expect(k.width, closeTo(72 * 656 / 708, 1e-9));
    expect(k.center.dx, closeTo(_phone.width / 2, 1e-9));
    expect(k.center.dy, closeTo(_phone.height / 2, 1e-9));
  });

  test('every other letter starts wholly below the slot', () {
    final slot = _stage.toScreen(const Offset(0, RiseIntro.slot)).dy;
    for (final glyph in _letters) {
      final start = _onScreen(glyph, RiseIntro.pose(glyph, 0));
      expect(start.top, greaterThan(slot), reason: '$glyph');
    }
  });

  test('the slot sits under every resting letter, so none is ever cut', () {
    for (final glyph in WordmarkGlyph.values) {
      expect(WordmarkGlyphs.bounds[glyph]!.bottom, lessThan(RiseIntro.slot));
    }
  });

  test('the word is assembled and centred once the intro is over', () {
    for (final glyph in WordmarkGlyph.values) {
      final end = _onScreen(glyph, RiseIntro.pose(glyph, RiseIntro.duration));
      final rest = _onScreen(glyph, GlyphPose.rest);
      // Springs are still settling by a tenth of a point; nothing visible.
      expect(
        (end.center - rest.center).distance,
        lessThan(0.25),
        reason: '$glyph',
      );
      expect(end.height, closeTo(rest.height, 0.25), reason: '$glyph');
    }
    final word =
        _onScreen(WordmarkGlyph.k, GlyphPose.rest).left +
        _onScreen(WordmarkGlyph.o, GlyphPose.rest).right;
    expect(word / 2, closeTo(_phone.width / 2, 1e-9));
  });

  test('the K only travels straight left', () {
    var previous = double.infinity;
    for (var t = 0.0; t <= 400; t += 4) {
      final k = _onScreen(WordmarkGlyph.k, RiseIntro.pose(WordmarkGlyph.k, t));
      expect(k.center.dy, closeTo(_phone.height / 2, 1e-9));
      expect(k.center.dx, lessThanOrEqualTo(previous + 1e-9));
      previous = k.center.dx;
    }
  });

  test('the letters come up in reading order', () {
    final slot = _stage.toScreen(const Offset(0, RiseIntro.slot)).dy;
    double firstShows(WordmarkGlyph glyph) {
      for (var t = 0.0; t <= RiseIntro.duration; t += 2) {
        if (_onScreen(glyph, RiseIntro.pose(glyph, t)).top < slot) return t;
      }
      fail('$glyph never rose');
    }

    final times = [for (final glyph in _letters) firstShows(glyph)];
    expect(times, orderedEquals([...times]..sort()));
  });

  test('the o winks once after it settles, and is open by the end', () {
    final shut = [
      for (var t = 0.0; t <= RiseIntro.duration; t += 2)
        if (RiseIntro.pose(WordmarkGlyph.o, t).scaleY < 0.5) t,
    ];

    expect(shut, isNotEmpty);
    // One blink: the shut frames form a single run.
    expect(shut.last - shut.first, lessThan(200));
    // Nobody else winks.
    for (final glyph in [WordmarkGlyph.k, ..._letters.take(3)]) {
      for (var t = 0.0; t <= RiseIntro.duration; t += 8) {
        expect(RiseIntro.pose(glyph, t).aboutCentre, isFalse);
      }
    }
    // Open again; the rise's spring is still settling by a hair.
    expect(
      RiseIntro.pose(WordmarkGlyph.o, RiseIntro.duration).scaleY,
      closeTo(1, 1e-3),
    );
  });
}
