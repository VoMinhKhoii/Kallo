import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/logic/portion/portion_anchors.dart';
import 'package:kallo_mobile/features/logging/logic/portion/vessel_data.dart';
import 'package:kallo_mobile/models/nutrition/vessel.dart';

/// The picker's layout math is driven entirely by the `aspect` numbers declared
/// alongside each filename in `vessel_data.dart`. A declared asset that isn't
/// bundled renders an invisible-but-tappable button, and one whose real
/// dimensions drift from its declared aspect renders stretched — both silently.
///
/// This is the Dart counterpart of
/// `lib/ai/portion/data/__tests__/vessel-assets.test.ts`,
/// which exists because exactly this shipped broken on web once. Dart has no
/// image-metadata reader in the test VM, so the aspect is pinned against the
/// web's own declarations rather than re-measured — the web test measures the
/// art, this one keeps the two declarations identical, and the pair covers it.

final _webVesselData = File('../../lib/ai/portion/data/vessel-tables.ts');
final _webAnchors = File(
  '../../components/logging/feed/meal-entry/portion/portion-anchors.ts',
);

List<VesselAsset> get _declaredAssets => [
  for (final family in vesselFamilies.values)
    for (final tier in family.values) tier.asset,
  for (final tier in pieceTiers) ...tier.assets,
]..sort((a, b) => a.file.compareTo(b.file));

void main() {
  group('portion vessel assets', () {
    test('declares one asset per vessel tier and piece kind', () {
      // 3 container families x 4 tiers + 5 piece tiers x 3 kinds.
      expect(_declaredAssets, hasLength(27));
      expect(_declaredAssets.map((a) => a.file).toSet(), hasLength(27));
    });

    test('bundles every declared asset under assets/portions', () {
      for (final asset in _declaredAssets) {
        expect(
          File(asset.path).existsSync(),
          isTrue,
          reason: '${asset.file} is declared but not bundled',
        );
      }
    });

    test('carries no undeclared files in the asset directory', () {
      final onDisk =
          Directory(portionAssetDir)
              .listSync()
              .whereType<File>()
              .map((f) => f.uri.pathSegments.last)
              .toList()
            ..sort();
      expect(onDisk, _declaredAssets.map((a) => a.file).toList());
    });

    test('declares the directory in pubspec so the bundle actually ships', () {
      // A file on disk that pubspec never lists is not in the app: Image.asset
      // would throw at runtime while every check above stayed green.
      expect(
        File('pubspec.yaml').readAsStringSync(),
        contains('- $portionAssetDir/'),
      );
    });

    test('matches every filename and aspect to the web declarations', () {
      // Skipped when the web tree isn't checked out beside the app (a
      // standalone Flutter checkout); in the monorepo it always runs.
      if (!_webVesselData.existsSync()) {
        markTestSkipped('web vessel-tables.ts not present');
        return;
      }
      final source = _webVesselData.readAsStringSync();
      for (final asset in _declaredAssets) {
        // Both clients write the pair on adjacent lines: `'file.webp'` then
        // `aspect: N`. Matching the pair catches a filename that moved tiers.
        final pattern = RegExp(
          // `aspect:` is REQUIRED, not optional. Optional, the capture bound to
          // whatever number happened to follow the filename — a tier, an `ml`,
          // anything — and the test could still pass while comparing the wrong
          // value. A false pass is the exact failure this file exists to catch.
          "'${RegExp.escape(asset.file)}',?\\s*aspect:\\s*([0-9.]+)",
        );
        final match = pattern.firstMatch(source);
        expect(match, isNotNull, reason: '${asset.file} missing from web data');
        expect(
          double.parse(match!.group(1)!),
          asset.aspect,
          reason: '${asset.file} aspect drifted from the web declaration',
        );
      }
    });

    // The two implementations are vendored copies of one design, and the
    // numbers below decide what a portion is ALLOWED to claim. If they drift,
    // web and Flutter commit different tiers for the same meal and nothing
    // else in either test suite notices — each side would still be internally
    // consistent. This is the only check that compares them.
    test('shares every load-bearing constant with the web implementation', () {
      if (!_webVesselData.existsSync() || !_webAnchors.existsSync()) {
        markTestSkipped('web sources not present');
        return;
      }
      final vesselSource = _webVesselData.readAsStringSync();
      final anchorSource = _webAnchors.readAsStringSync();

      double webConst(String source, String name) {
        final match = RegExp(
          'const $name(?::\\s*number)?\\s*=\\s*([0-9.]+)',
        ).firstMatch(source);
        expect(match, isNotNull, reason: '$name missing from the web source');
        return double.parse(match!.group(1)!);
      }

      expect(
        webConst(vesselSource, 'MAX_PIECE_COUNT'),
        maxPieceCount,
        reason: 'the plausibility cap drifted',
      );
      expect(
        webConst(anchorSource, 'ENVELOPE_MIN_FACTOR'),
        envelopeMinFactor,
        reason: 'the envelope floor drifted',
      );
      expect(
        webConst(anchorSource, 'ENVELOPE_MAX_FACTOR'),
        envelopeMaxFactor,
        reason: 'the envelope ceiling drifted',
      );
      expect(
        webConst(anchorSource, 'CLAIM_BAND'),
        claimBand,
        reason: 'the claim band drifted — the two clients would now disagree '
            'about which tier a portion may call itself',
      );
      expect(
        webConst(anchorSource, 'POSITION_MAX'),
        positionMax.toDouble(),
        reason: 'the ruler position space drifted',
      );

      // Tier tables: grams per piece tier, millilitres per container tier.
      final webGrams = RegExp(r'pieceTier\(\s*(\d+)')
          .allMatches(vesselSource)
          .map((m) => int.parse(m.group(1)!))
          .toList();
      expect(
        webGrams,
        pieceTiers.map((t) => t.grams).toList(),
        reason: 'piece tier grams drifted',
      );

      // Per family, not one flat list. Flattened, the comparison silently
      // depended on the TypeScript declaration order matching Dart's map
      // iteration order — a pure reorder failed with an opaque list mismatch,
      // and two families swapping equal millilitres passed.
      final familyStarts = <ContainerFamily, int>{
        for (final family in ContainerFamily.values)
          family: vesselSource.indexOf(RegExp('\\n  ${family.name}: \\{')),
      };
      for (final entry in familyStarts.entries) {
        expect(
          entry.value,
          isNonNegative,
          reason: '${entry.key.name} block missing from web data',
        );
      }
      final ordered = familyStarts.entries.toList()
        ..sort((a, b) => a.value.compareTo(b.value));
      for (final (i, entry) in ordered.indexed) {
        final end = i + 1 < ordered.length ? ordered[i + 1].value : null;
        final block = vesselSource.substring(entry.value, end);
        expect(
          RegExp(r'\bml:\s*(\d+)')
              .allMatches(block)
              .map((m) => int.parse(m.group(1)!))
              .toList(),
          [for (final tier in vesselFamilies[entry.key]!.values) tier.ml],
          reason: '${entry.key.name} tier millilitres drifted',
        );
      }
    });
  });
}
