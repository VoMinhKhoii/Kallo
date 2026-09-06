import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// An icon glyph whose font is not bundled paints as a tofu box — and nothing
/// catches it. `CupertinoIcons` is declared by `flutter/cupertino.dart`, which
/// every Cupertino-flavoured widget already imports, so
/// `CupertinoIcons.doc_on_clipboard` compiles, analyzes and renders in a widget
/// test exactly like a real glyph. The font behind it ships in the
/// `cupertino_icons` package, which this app does not depend on: on device it
/// was a "?" box in the middle of the long-press menu on the Log feed's
/// message bubble (fixed 2026-09-05).
///
/// So the rule AGENTS.md states — Lucide is the app's one icon set — needs a
/// gate, because neither the compiler nor the analyzer can enforce it. Same
/// shape as `portion_vessel_assets_test.dart`: what the code declares has to
/// be something the bundle actually carries.
/// Comments talk ABOUT the banned symbol — the bubble's own doc comment
/// records why it lost its `CupertinoIcons` glyph — so the scan reads code
/// lines only.
String _code(String source) => source
    .split('\n')
    .map((line) {
      if (line.trimLeft().startsWith('//')) return '';
      final marker = line.indexOf('//');
      // `https://` is the one mid-line `//` in this codebase that is not the
      // start of a comment.
      if (marker == -1 || line.substring(0, marker).endsWith(':')) return line;
      return line.substring(0, marker);
    })
    .join('\n');

void main() {
  group('icon fonts', () {
    final sources = Directory('lib')
        .listSync(recursive: true)
        .whereType<File>()
        .where((f) => f.path.endsWith('.dart'))
        .toList();

    test('finds the app source to scan', () {
      expect(sources, isNotEmpty);
    });

    test('no glyph comes from a font the app does not bundle', () {
      final offenders = [
        for (final file in sources)
          if (_code(file.readAsStringSync()).contains('CupertinoIcons.'))
            file.path,
      ]..sort();

      expect(
        offenders,
        isEmpty,
        reason:
            'CupertinoIcons needs the cupertino_icons package, which is not a '
            'dependency — these glyphs would paint as tofu boxes. Use the '
            'Lucide 300 equivalent (AGENTS.md: Lucide is the one icon set).',
      );
    });

    test('cupertino_icons is still absent, so the gate above still bites', () {
      // If it is ever added as a real dependency this test is the place to
      // decide that deliberately, rather than discovering it in a screenshot.
      expect(
        File('pubspec.yaml').readAsStringSync().contains('cupertino_icons'),
        isFalse,
      );
    });
  });
}
