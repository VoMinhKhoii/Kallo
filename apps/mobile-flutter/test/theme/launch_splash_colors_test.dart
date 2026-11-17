import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/theme/kallo_palette.dart';

/// The native launch splash (`ios/Runner/RootViewController.swift`) draws the
/// launch curtain's first frame before Dart runs, so it carries its own copy
/// of each palette's canvas and ink. A drift shows as a colour step at launch.
void main() {
  String hex(int argb) =>
      '0x${(argb & 0xFFFFFF).toRadixString(16).padLeft(6, '0').toUpperCase()}';

  test('the native splash paints each palette\'s canvas and ink', () {
    final swift =
        File('ios/Runner/RootViewController.swift').readAsStringSync();
    for (final id in KalloPaletteId.values) {
      final palette = KalloPalette.byId(id);
      final line =
          'private static let ${id.name} = (canvas: rgb(${hex(palette.surface.toARGB32())}), '
          'ink: rgb(${hex(palette.text.toARGB32())}))';
      expect(swift, contains(line), reason: id.name);
    }
  });
}
