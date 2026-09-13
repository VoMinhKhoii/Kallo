import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'app_fonts.dart';

/// Guards the one thing `loadAppFonts` cannot check about itself.
///
/// A missing weight does not throw — Flutter silently substitutes the nearest
/// loaded face — so under-loading is invisible until something compares pixels.
/// That is exactly how a w600 title spent a release rendering as Medium. The
/// list in `app_fonts.dart` is a hand-written mirror of `pubspec.yaml`; without
/// this test, adding a fifth weight reproduces the bug with no signal at all.
void main() {
  test('loadAppFonts covers every weight the pubspec declares', () {
    final declared =
        RegExp(r'assets/google_fonts/BeVietnamPro-(\w+)\.ttf')
            .allMatches(File('pubspec.yaml').readAsStringSync())
            .map((m) => m.group(1)!)
            .toSet();

    expect(
      declared,
      isNotEmpty,
      reason: 'the pubspec regex found no faces — it has gone stale',
    );
    expect(
      appFontWeights.toSet(),
      declared,
      reason:
          'app_fonts.dart must load every declared weight; a missing one is '
          'substituted silently, not reported',
    );
  });
}
