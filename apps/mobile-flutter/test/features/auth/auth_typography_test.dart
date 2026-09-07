import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// The pre-auth surfaces spend no serif. The wordmark is the brand's one
/// typographic voice on these screens and it is drawn, not set — a Lora
/// heading under it put a second editorial voice in the same viewport, and the
/// type system allows exactly one.
///
/// Grep-based on purpose: the rule is "nowhere in this folder", which a widget
/// test can only ever check one screen at a time.
void main() {
  test('no Lora anywhere under lib/features/auth', () {
    final offenders = <String>[];
    for (final entity in Directory('lib/features/auth').listSync(
      recursive: true,
    )) {
      if (entity is! File || !entity.path.endsWith('.dart')) continue;
      final source = entity.readAsStringSync();
      if (source.contains('serifRegular') ||
          source.contains('serifFamily') ||
          source.contains("'Lora'")) {
        offenders.add(entity.path);
      }
    }
    expect(
      offenders,
      isEmpty,
      reason: 'serif type on an auth surface — use kPageTitle/kSectionHeader',
    );
  });
}
