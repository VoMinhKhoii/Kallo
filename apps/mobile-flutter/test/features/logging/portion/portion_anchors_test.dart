import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/logic/portion/portion_anchors.dart';
import 'package:kallo_mobile/features/logging/logic/portion/portion_display.dart';
import 'package:kallo_mobile/features/logging/logic/portion/ruler_scale.dart';
import 'package:kallo_mobile/features/logging/logic/portion/vessel_data.dart';
import 'package:kallo_mobile/models/nutrition/vessel.dart';

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

  group('fractional piece counts', () {
    const half = PieceVessel(tier: 3, count: 1.5, kind: PieceKind.fish);

    test('scale the anchors exactly, matching web', () {
      // Web: count * tierGrams, no rounding anywhere.
      expect(
        buildPieceAnchors(half, 'en').map((a) => a.value),
        [45.0, 105.0, 225.0, 375.0, 750.0],
      );
    });

    test('claim the tier they land on', () {
      final anchors = buildPieceAnchors(half, 'en');
      // 225 g IS 1.5 × the 150 g tier — web claims it, so must we. Truncating
      // count to 1 made this a "custom portion" 50% off its tier-3 anchor.
      expect(claimedAnchor(anchors, 225)?.tier, 3);
      expect((repointVessel(half, anchors, 225) as PieceVessel).tier, 3);
    });

    test('print like JS numbers — no trailing .0', () {
      expect(formatAnchorGrams(225), '225');
      expect(formatAnchorGrams(37.5), '37.5');
      expect(countPrefixFor(half), '1.5 × ');
      expect(
        countPrefixFor(const PieceVessel(tier: 1, count: 3, kind: PieceKind.meat)),
        '3 × ',
      );
      // A single piece carries no prefix at all.
      expect(
        countPrefixFor(const PieceVessel(tier: 1, count: 1, kind: PieceKind.meat)),
        '',
      );
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

  group('RulerScale', () {
    const piece = PieceVessel(tier: 3, count: 1, kind: PieceKind.fish);
    final anchors = buildPieceAnchors(piece, 'en');
    final envelope = gramEnvelope(anchors);
    final scale = RulerScale(anchors, envelope.min, envelope.max);

    test('puts every anchor on its own fixed track position', () {
      final positions = positionBreaks(anchors.length);
      for (final (i, anchor) in anchors.indexed) {
        // Anchor i sits at breakpoint i+1 (breakpoint 0 is the track start).
        expect(scale.toPosition(anchor.value.round()), closeTo(positions[i + 1], 1e-9));
      }
    });

    test('round-trips grams through position space', () {
      for (final grams in [18, 30, 70, 150, 250, 500, 600]) {
        expect(scale.toGrams(scale.toPosition(grams)), grams);
      }
    });

    test('derives divisions worth at least a gram apiece', () {
      expect(scale.step, greaterThanOrEqualTo(1));
      // NOT `positionMax ~/ step`. Material spreads `divisions` as equal
      // intervals, so the grid has to contain the anchor positions — see
      // RulerScale.divisions and portion_hostile_input_test.dart.
      expect(positionMax / scale.divisions, lessThanOrEqualTo(scale.step));
      expect(scale.divisions % (2 * anchors.length), 0);
    });

    test('detects a mid-anchor reshuffle, not just a length change', () {
      // The trap the widget's resync used to miss: same count, same endpoints,
      // different middle values.
      final moved = [
        anchors.first,
        PortionAnchor(tier: 2, value: anchors[1].value + 5, label: 'x'),
        ...anchors.skip(2),
      ];
      expect(
        RulerScale(moved, envelope.min, envelope.max).differsFrom(scale),
        isTrue,
      );
      expect(
        RulerScale(anchors, envelope.min, envelope.max).differsFrom(scale),
        isFalse,
      );
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

