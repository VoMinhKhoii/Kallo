import 'dart:convert';
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

  // iOS draws the launch storyboard before any app code runs, in the phone's
  // light or dark mode; its background is this colour set.
  test('the launch storyboard background is the light and dark canvas', () {
    final colorset =
        jsonDecode(
              File(
                'ios/Runner/Assets.xcassets/LaunchBackground.colorset/Contents.json',
              ).readAsStringSync(),
            )
            as Map<String, dynamic>;
    final entries = (colorset['colors'] as List).cast<Map<String, dynamic>>();
    bool isDark(Map<String, dynamic> entry) =>
        (entry['appearances'] as List? ?? const []).any(
          (a) => a['appearance'] == 'luminosity' && a['value'] == 'dark',
        );
    expect(entries, hasLength(2));

    String byte(int argb, int shift) =>
        '0x${((argb >> shift) & 0xFF).toRadixString(16).padLeft(2, '0').toUpperCase()}';
    for (final (id, entry) in [
      (KalloPaletteId.light, entries.singleWhere((e) => !isDark(e))),
      (KalloPaletteId.dark, entries.singleWhere(isDark)),
    ]) {
      final canvas = KalloPalette.byId(id).surface.toARGB32();
      expect(entry['color'], {
        'color-space': 'srgb',
        'components': {
          'alpha': '1.000',
          'red': byte(canvas, 16),
          'green': byte(canvas, 8),
          'blue': byte(canvas, 0),
        },
      }, reason: id.name);
    }
  });
}
