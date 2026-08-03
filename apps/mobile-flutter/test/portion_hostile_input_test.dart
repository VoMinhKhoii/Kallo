import 'package:flutter_test/flutter_test.dart';

import 'package:nham_mobile/features/logging/logic/portion/portion_anchors.dart';
import 'package:nham_mobile/features/logging/logic/portion/ruler_scale.dart';
import 'package:nham_mobile/models/meal.dart';
import 'package:nham_mobile/models/vessel.dart';

/// Hostile and malformed vessel payloads.
///
/// The vessel is a DECORATION — a silhouette and a label under a dish. It must
/// never be able to break the meal it decorates. An adversarial review pass
/// found it could, three ways, all of them reachable from a single bad field in
/// one item of one meal:
///
///   - `{"tier": "3"}` threw out of `MealItem.fromJson`, failing the whole
///     `ParsedMeal` and blanking the day's feed.
///   - `count: -1` built a descending envelope whose `clamp(-18, -600)` threw
///     while opening the sheet; `NaN`/`Infinity` threw in `gramEnvelope`.
///   - `count: 1e9` was accepted, clamped a normal 150 g dish up to 18 billion
///     grams, and staged it for confirmation with macros scaled ~1.2e8.
///
/// The contract these tests pin: parsing degrades, never throws, and anything
/// that survives parsing is safe to do arithmetic on.

Map<String, dynamic> _itemWith(Object? vessel) => {
  'id': 'item-1',
  'name': 'cá kho',
  'quantity': 150,
  'unit': 'g',
  'macros': {'calories': 300, 'protein': 30, 'carbs': 4, 'fat': 30},
  'vessel': vessel,
};

void main() {
  group('malformed payloads degrade instead of throwing', () {
    final malformed = <Object?>[
      // Wrong primitive types where a number is expected.
      {'family': 'piece', 'tier': '3', 'count': 1, 'kind': 'fish'},
      {'family': 'piece', 'tier': 3, 'count': '1.5', 'kind': 'fish'},
      {'family': 'bowl', 'tier': '2', 'dishClass': 'soup'},
      // A tier that is a number but not a whole one.
      {'family': 'bowl', 'tier': 2.5, 'dishClass': 'soup'},
      // Non-finite tier.
      {'family': 'bowl', 'tier': double.nan, 'dishClass': 'soup'},
      // The vessel key itself carrying the wrong shape entirely.
      <dynamic>[],
      'nonsense',
      42,
      // Missing discriminators.
      <String, dynamic>{},
      {'family': 'piece'},
    ];

    for (final (index, bad) in malformed.indexed) {
      test('payload #$index yields no vessel and no exception', () {
        expect(() => ClientVessel.fromJson(bad), returnsNormally);
        expect(ClientVessel.fromJson(bad), isNull);
        // The whole-meal path is the one that actually matters: a throw here
        // takes down every dish in the meal, not just this one's silhouette.
        expect(() => MealItem.fromJson(_itemWith(bad)), returnsNormally);
        expect(MealItem.fromJson(_itemWith(bad)).vessel, isNull);
      });
    }
  });

  group('piece counts', () {
    ClientVessel? parse(Object? count) => ClientVessel.fromJson({
      'family': 'piece',
      'tier': 3,
      'count': count,
      'kind': 'fish',
    });

    test('rejects counts the arithmetic cannot survive', () {
      for (final bad in <double>[
        -1,
        0,
        0.5,
        double.nan,
        double.infinity,
        double.negativeInfinity,
        1e9,
        maxPieceCount + 1,
      ]) {
        expect(parse(bad), isNull, reason: 'count=$bad must not parse');
      }
    });

    test('accepts the real range, fractions included', () {
      for (final ok in <double>[1, 1.5, 2, 3.25, 12, maxPieceCount]) {
        final vessel = parse(ok);
        expect(vessel, isA<PieceVessel>(), reason: 'count=$ok must parse');
        expect((vessel! as PieceVessel).count, ok);
      }
    });

    test('every parseable count is safe to build an envelope from', () {
      // The property that matters: if it parsed, the picker can open it.
      for (var count = 1.0; count <= maxPieceCount; count += 0.25) {
        final vessel = parse(count)! as PieceVessel;
        final anchors = buildPieceAnchors(vessel, 'en');
        final envelope = gramEnvelope(anchors);
        expect(envelope.min, lessThanOrEqualTo(envelope.max));
        expect(envelope.min, greaterThan(0));
        // Opening the sheet clamps the dish's grams into the envelope; that
        // clamp is what threw on a descending range.
        expect(() => 150.clamp(envelope.min, envelope.max), returnsNormally);
        expect(() => RulerScale(anchors, envelope.min, envelope.max).divisions,
            returnsNormally);
      }
    });
  });

  group('ruler divisions grid', () {
    // Material treats `divisions` as N equal intervals, not as steps of our
    // `step`. When the grid does not contain the anchor positions, tapping an
    // anchor paints the thumb off its own tick and the first touch snaps the
    // portion to a different number — 70 g became 69 g before the fix.
    test('contains every anchor exactly, for every parseable count', () {
      for (var count = 1.0; count <= maxPieceCount; count += 0.25) {
        final vessel = PieceVessel(
          tier: 3,
          count: count,
          kind: PieceKind.fish,
        );
        final anchors = buildPieceAnchors(vessel, 'en');
        final envelope = gramEnvelope(anchors);
        final scale = RulerScale(anchors, envelope.min, envelope.max);

        for (final anchor in anchors) {
          final grams = anchor.value.round();
          final position = scale.toPosition(grams);
          // Snap the way Material does: round to the nearest of N intervals.
          final snapped =
              (position / positionMax * scale.divisions).round() /
              scale.divisions *
              positionMax;
          expect(
            scale.toGrams(snapped),
            grams,
            reason:
                'count=$count anchor ${anchor.value}g lands off the '
                '${scale.divisions}-division grid',
          );
        }
      }
    });

    test('keeps one division worth at least a gram', () {
      // The reason `divisions` exists at all: a screen-reader swipe moves one
      // division, and it must move the portion by something.
      for (var count = 1.0; count <= maxPieceCount; count += 0.25) {
        final vessel = PieceVessel(
          tier: 3,
          count: count,
          kind: PieceKind.fish,
        );
        final anchors = buildPieceAnchors(vessel, 'en');
        final envelope = gramEnvelope(anchors);
        final scale = RulerScale(anchors, envelope.min, envelope.max);
        final interval = positionMax / scale.divisions;
        expect(
          interval,
          lessThanOrEqualTo(scale.step.toDouble()),
          reason: 'count=$count divisions are coarser than the computed step',
        );
      }
    });
  });
}
