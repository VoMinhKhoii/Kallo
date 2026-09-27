import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shared/widgets/brand/wordmark_glyphs.dart';

void main() {
  test('the letters join back into the brand file, byte for byte', () {
    // The launch intro moves these letters one by one; the rest of the app
    // wears them joined. Both must be the drawn mark, not a retyped copy.
    final svg =
        File(
          '../../docs/brand/kallo/assets/kallo-wordmark.svg',
        ).readAsStringSync();
    final d = RegExp(r' d="([^"]+)"').firstMatch(svg)![1];

    expect(WordmarkGlyphs.svgPathData, d);
  });

  test('each letter parses to the ink box it declares', () {
    for (final glyph in WordmarkGlyph.values) {
      final parsed = WordmarkGlyphs.pathOf(glyph).getBounds();
      final declared = WordmarkGlyphs.bounds[glyph]!;
      for (final (a, b) in [
        (parsed.left, declared.left),
        (parsed.top, declared.top),
        (parsed.right, declared.right),
        (parsed.bottom, declared.bottom),
      ]) {
        expect(a, closeTo(b, 1), reason: '$glyph: $parsed vs $declared');
      }
    }
  });

  test('the a and the o keep their holes', () {
    // A fill-rule slip paints a counter solid, which no box can see.
    final a = WordmarkGlyphs.pathOf(WordmarkGlyph.a);
    final o = WordmarkGlyphs.pathOf(WordmarkGlyph.o);

    expect(a.contains(const Offset(857, 618)), isFalse, reason: "a's bowl");
    expect(a.contains(const Offset(1020, 700)), isTrue, reason: "a's stem");
    expect(o.contains(const Offset(1884, 526)), isFalse, reason: "o's hole");
    expect(o.contains(const Offset(1690, 526)), isTrue, reason: "o's ring");
  });
}
