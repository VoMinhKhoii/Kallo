import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';

import 'package:nham_mobile/features/logging/logic/portion/portion_anchors.dart';
import 'package:nham_mobile/features/logging/logic/portion/vessel_data.dart';
import 'package:nham_mobile/models/vessel.dart';

/// Dart port of the web's
/// `components/logging/feed/meal-entry/portion/portion-anchors.test.ts`. The two
/// clients must agree on what a portion may claim and how big a silhouette
/// draws, so the assertions are deliberately the same ones.

const anchors = [
  PortionAnchor(tier: 1, value: 100, label: 'small'),
  PortionAnchor(tier: 2, value: 200, label: 'medium'),
  PortionAnchor(tier: 3, value: 300, label: 'large'),
  PortionAnchor(tier: 4, value: 400, label: 'extra large'),
];

({double width, double height, double area}) _glyph(
  int tierIndex,
  PieceKind kind,
) {
  final tier = pieceTiers[tierIndex];
  final aspect = tier.assetFor(kind).aspect;
  final width = glyphWidthRatio(tier.grams, aspect);
  final height = width / aspect;
  return (width: width, height: height, area: width * height);
}

void main() {
  group('gramEnvelope', () {
    test('spans 60% of the first anchor to 120% of the last', () {
      final envelope = gramEnvelope(anchors);
      expect(envelope.min, 60);
      expect(envelope.max, 480);
    });
  });

  group('nearestAnchor', () {
    test('returns exact and nearest anchors', () {
      expect(nearestAnchor(anchors, 200).tier, 2);
      expect(nearestAnchor(anchors, 275).tier, 3);
    });
  });

  group('claimedAnchor', () {
    test('claims a tier at its exact value', () {
      expect(claimedAnchor(anchors, 200)?.tier, 2);
    });

    test('claims a tier at both ±10% edges', () {
      expect(claimedAnchor(anchors, 180)?.tier, 2);
      expect(claimedAnchor(anchors, 220)?.tier, 2);
    });

    test('claims nothing outside the band', () {
      expect(claimedAnchor(anchors, 250), isNull);
      expect(claimedAnchor(anchors, 500), isNull);
    });
  });

  group('committedPieceTier', () {
    const pieceAnchors = [
      PortionAnchor(tier: 1, value: 100, label: 'small'),
      PortionAnchor(tier: 2, value: 200, label: 'medium'),
      PortionAnchor(tier: 3, value: 300, label: 'large'),
    ];

    test('commits the claimed tier at an anchor and at the band edge', () {
      expect(committedPieceTier(1, pieceAnchors, 300), 3);
      expect(committedPieceTier(1, pieceAnchors, 330), 3);
    });

    test('preserves the current tier for a custom portion', () {
      expect(committedPieceTier(3, pieceAnchors, 500), 3);
      expect(committedPieceTier(1, pieceAnchors, 250), 1);
    });
  });

  group('repointVessel', () {
    const piece = PieceVessel(tier: 2, count: 1, kind: PieceKind.fish);
    final pieceAnchors = buildPieceAnchors(piece, 'en');

    test('re-points a piece only to a tier the picker claimed', () {
      // 250 g is tier 4 exactly.
      expect((repointVessel(piece, pieceAnchors, 250) as PieceVessel).tier, 4);
      // 200 g claims nothing (>10% from both 150 and 250) — tier is untouched.
      expect((repointVessel(piece, pieceAnchors, 200) as PieceVessel).tier, 2);
    });

    test('re-points a container to the nearest anchor, band or not', () {
      const bowl = ContainerVessel(
        family: ContainerFamily.bowl,
        tier: 1,
        dishClass: DishClass.soup,
      );
      final bowlAnchors = buildContainerAnchors(bowl, 'en');
      final nearest = nearestAnchor(bowlAnchors, 900).tier;
      expect(
        (repointVessel(bowl, bowlAnchors, 900) as ContainerVessel).tier,
        nearest,
      );
    });
  });

  group('anchor position helpers', () {
    test('spaces five anchors at the fixed positions', () {
      expect(anchorPositions(5), [0.1, 0.3, 0.5, 0.7, 0.9]);
      expect(positionBreaks(5), [0, 100, 300, 500, 700, 900, 1000]);
    });
  });

  group('buildContainerAnchors / buildPieceAnchors', () {
    test('containers expose four tiers, pieces five, scaled by count', () {
      const bowl = ContainerVessel(
        family: ContainerFamily.bowl,
        tier: 2,
        dishClass: DishClass.soup,
      );
      final bowlAnchors = buildContainerAnchors(bowl, 'vi');
      expect(bowlAnchors.map((a) => a.tier), [1, 2, 3, 4]);
      expect(bowlAnchors[1].label, 'tô vừa');

      const piece = PieceVessel(tier: 1, count: 3, kind: PieceKind.meat);
      final pieceAnchors = buildPieceAnchors(piece, 'en');
      expect(pieceAnchors.map((a) => a.tier), [1, 2, 3, 4, 5]);
      // Three pieces of a 30 g tier is a 90 g portion.
      expect(pieceAnchors.first.value, 90);
      expect(pieceAnchors.first.label, 'small piece');
    });
  });

  group('glyphWidthRatio', () {
    final everyGlyph = [
      for (final kind in PieceKind.values)
        for (var i = 0; i < pieceTiers.length; i++) _glyph(i, kind),
    ];

    test('keeps every silhouette inside its column', () {
      // The bug this replaces: a tier-5 fish was 130px wide in a ~54px column,
      // overlapping tier 4 and spilling off the right of the row.
      expect(everyGlyph, hasLength(15));
      for (final glyph in everyGlyph) {
        expect(glyph.width, greaterThan(0));
        expect(glyph.width, lessThanOrEqualTo(1));
      }
    });

    test('lets the widest silhouette fill its column exactly', () {
      // A slack normaliser would shrink every glyph for no reason.
      final widest = everyGlyph
          .map((g) => g.width)
          .reduce((a, b) => a > b ? a : b);
      expect(widest, closeTo(1, 1e-10));
    });

    test('sizes the row to the tallest glyph, no slack and no clipping', () {
      final columns = pieceTiers.length;
      // Row height in column widths, recovered from the aspect the row is given.
      final rowHeight = columns / glyphRowAspect(columns);
      final tallest = everyGlyph
          .map((g) => g.height)
          .reduce((a, b) => a > b ? a : b);
      expect(rowHeight, closeTo(tallest, 1e-10));
      for (final glyph in everyGlyph) {
        expect(glyph.height, lessThanOrEqualTo(rowHeight));
      }
    });

    test('grows visual area strictly across the tiers, for every kind', () {
      for (final kind in PieceKind.values) {
        final areas = [
          for (var i = 0; i < pieceTiers.length; i++) _glyph(i, kind).area,
        ];
        for (var i = 1; i < areas.length; i++) {
          expect(areas[i], greaterThan(areas[i - 1]));
        }
      }
    });

    test('gives equal grams equal area whatever the art\'s shape', () {
      // Height alone used to carry the amount, so a wide fillet read as far
      // more food than a compact drumstick of the same weight.
      for (var i = 0; i < pieceTiers.length; i++) {
        final fish = _glyph(i, PieceKind.fish).area;
        expect(_glyph(i, PieceKind.meat).area, closeTo(fish, 1e-10));
        expect(_glyph(i, PieceKind.poultry).area, closeTo(fish, 1e-10));
      }
    });

    test('scales area as grams^(2/3) — the cbrt law the ruler always meant', () {
      final smallest = _glyph(0, PieceKind.fish).area;
      final largest = _glyph(pieceTiers.length - 1, PieceKind.fish).area;
      final grams = pieceTiers.last.grams / pieceTiers.first.grams;
      expect(largest / smallest, closeTo(math.pow(grams, 2 / 3), 1e-10));
    });
  });

  group('rulerStep', () {
    test('moves at least 1 g in every segment', () {
      const gramBreaks = [60, 100, 200, 300, 400, 500, 600];
      final breaks = positionBreaks(5);
      final step = rulerStep(gramBreaks, breaks);
      for (var i = 0; i < breaks.length - 1; i++) {
        final gramsPerStep =
            (step * (gramBreaks[i + 1] - gramBreaks[i])) /
            (breaks[i + 1] - breaks[i]);
        expect(gramsPerStep, greaterThanOrEqualTo(1));
      }
    });

    test('ignores zero-width gram segments and never returns 0', () {
      expect(rulerStep([100, 100, 100], [0, 500, 1000]), 1);
    });
  });

  group('interpolate', () {
    test('maps grams to positions and back through the anchor breaks', () {
      final breaks = positionBreaks(5);
      const gramBreaks = [18, 30, 70, 150, 250, 500, 600];
      for (final grams in [18, 30, 70, 150, 250, 500, 600]) {
        final position = interpolate(grams.toDouble(), gramBreaks, breaks);
        expect(interpolate(position, breaks, gramBreaks), closeTo(grams, 1e-9));
      }
    });

    test('clamps outside the domain instead of extrapolating', () {
      expect(interpolate(-5, [0, 10], [100, 200]), 100);
      expect(interpolate(99, [0, 10], [100, 200]), 200);
    });
  });
}

