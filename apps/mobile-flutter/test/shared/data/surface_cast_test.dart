import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/data/surface_cast.dart';

/// A slug that names no bundled file renders nothing at all — SvgPicture.asset
/// fails at runtime while every other check stays green. The cast is small and
/// hand-written, so every cell of it is walked against the disk here.
void main() {
  group('surfaceIllustrationAsset', () {
    test('resolves every area x kind x day/night to a bundled file', () {
      for (final area in SurfaceArea.values) {
        for (final kind in SurfaceKind.values) {
          for (final lateNight in [false, true]) {
            final path = surfaceIllustrationAsset(
              area,
              kind,
              lateNight: lateNight,
            );
            expect(
              File(path).existsSync(),
              isTrue,
              reason: '$path (${area.name}/${kind.name}/night=$lateNight) '
                  'is not bundled',
            );
          }
        }
      }
    });

    test('draws on exactly the 18 poses of the cast', () {
      final paths = <String>{
        for (final area in SurfaceArea.values)
          for (final kind in SurfaceKind.values)
            for (final lateNight in [false, true])
              surfaceIllustrationAsset(area, kind, lateNight: lateNight),
      };
      expect(paths, hasLength(18));
      expect(
        Directory(illustrationAssetDir)
            .listSync()
            .whereType<File>()
            .where((f) => f.path.endsWith('.svg'))
            .length,
        18,
      );
    });

    test('falls back to the area empty pose for a kind it has no art for', () {
      expect(
        surfaceIllustrationAsset(
          SurfaceArea.circle,
          SurfaceKind.notFound,
          lateNight: false,
        ),
        'assets/illustrations/capybara-telescope.svg',
      );
    });

    test('lets night win over the state', () {
      expect(
        surfaceIllustrationAsset(
          SurfaceArea.circle,
          SurfaceKind.error,
          lateNight: true,
        ),
        'assets/illustrations/capybara-sleeping-hammock.svg',
      );
    });

    test('declares the directory in pubspec so the bundle actually ships', () {
      expect(
        File('pubspec.yaml').readAsStringSync(),
        contains('- $illustrationAssetDir/'),
      );
    });
  });
}
