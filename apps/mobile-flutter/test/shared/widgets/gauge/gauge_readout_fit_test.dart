import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/widgets/gauge/gauge_arc_geometry.dart';
import 'package:kallo_mobile/shared/widgets/gauge/gauge_clear_area.dart';
import 'package:kallo_mobile/shared/widgets/gauge/gauge_dial.dart';
import 'package:kallo_mobile/shared/widgets/gauge/gauge_readout_type.dart';
import 'package:kallo_mobile/shared/widgets/gauge/macro_dial_row.dart';
import 'package:kallo_mobile/shared/widgets/gauge/rounded_gauge_arc.dart';

import '../../../app_fonts.dart';

/// The macro dials' figures must stay INSIDE the arc they belong to.
///
/// Device QA on the Threads-ramp build (2026-09-01) caught `202g` and `547g`
/// running straight across the stroke on both sides — on the Today row's
/// full-size dials and the Log header's compact ones alike. Nothing bounded
/// the readout: `GaugeDial` draws each line `softWrap: false` with visible
/// overflow, so a wide enough figure simply painted over the band.
///
/// The claim here is geometric, not a golden: every corner of the rendered
/// figure sits within the dial's clear middle — inside the band's inner radius
/// where the band is present, or inside the 120° mouth below the tips where it
/// is not. That holds at any figure length and any text scale, so it does not
/// need re-deriving when the ramp moves again.
void main() {
  setUpAll(loadAppFonts);

  Widget wrap(Widget child, {required double width, required double scale}) =>
      MediaQuery(
        data: MediaQueryData(textScaler: TextScaler.linear(scale)),
        child: Directionality(
          textDirection: TextDirection.ltr,
          child: Center(child: SizedBox(width: width, child: child)),
        ),
      );

  /// The arc's centre in global coordinates, and its outer radius.
  ///
  /// Read off the painted arc itself rather than recomputed, so the assertion
  /// cannot drift from where the dial actually draws: the painter puts the
  /// centre `outerRadius` below the top of its own box (see `_GaugePainter`).
  (Offset, double) arcCentre(WidgetTester tester, Finder dial) {
    final arc = find.descendant(
      of: dial,
      matching: find.byType(RoundedGaugeArc),
    );
    final box = tester.getRect(arc);
    final radius = tester.widget<RoundedGaugeArc>(arc).outerRadius;
    return (Offset(box.center.dx, box.top + radius), radius);
  }

  /// Is [p] inside the dial's clear middle?
  bool isClear(Offset p, Offset centre, double radius) {
    final depth = p.dy - centre.dy;
    final dx = (p.dx - centre.dx).abs();
    // A hair of tolerance: the readout is centred on a subpixel boundary and
    // the glyph box carries side bearings the ink never reaches.
    return dx <= gaugeClearHalfWidth(radius, depth) + 0.5;
  }

  void expectFigureInsideDial(
    WidgetTester tester, {
    required String figure,
    required int dialIndex,
  }) {
    final dial = find.byType(GaugeDial).at(dialIndex);
    final (centre, radius) = arcCentre(tester, dial);
    final rect = tester.getRect(find.text(figure));

    for (final corner in [
      rect.topLeft,
      rect.topRight,
      rect.bottomLeft,
      rect.bottomRight,
    ]) {
      expect(
        isClear(corner, centre, radius),
        isTrue,
        reason:
            '"$figure" corner $corner leaves the clear area of the dial '
            'centred at $centre (outer radius $radius, inner '
            '${gaugeInnerRadius(radius).toStringAsFixed(1)}); the figure '
            'crosses its own arc',
      );
    }
    // And it is taken in, never clipped away to a different number.
    expect(rect.width, greaterThan(0));
  }

  // The Log header hands the three dials what is left of a 390pt phone after
  // the compact calorie dial and the gutters; the Today row gives them a full
  // screen width. Both are in the QA report.
  const widths = <String, double>{'log header': 214, 'today row': 366};
  const scales = <double>[1.0, 1.3];

  for (final entry in widths.entries) {
    for (final scale in scales) {
      testWidgets(
        'three-digit macro figures stay inside the dial — '
        '${entry.key} @${scale}x',
        (tester) async {
          await tester.pumpWidget(
            wrap(
              const MacroDialRow.compact(
                current: {
                  'protein': 202,
                  'carbohydrate': 547,
                  'fat': 180,
                },
                target: {
                  'protein': 180,
                  'carbohydrate': 400,
                  'fat': 90,
                },
              ),
              width: entry.value,
              scale: scale,
            ),
          );
          await tester.pumpAndSettle();

          expectFigureInsideDial(tester, figure: '202g', dialIndex: 0);
          expectFigureInsideDial(tester, figure: '547g', dialIndex: 1);
          expectFigureInsideDial(tester, figure: '180g', dialIndex: 2);
        },
      );

      testWidgets(
        'four-digit macro figures stay inside the dial — '
        '${entry.key} @${scale}x',
        (tester) async {
          await tester.pumpWidget(
            wrap(
              const MacroDialRow.compact(
                current: {
                  'protein': 1047,
                  'carbohydrate': 1382,
                  'fat': 1180,
                },
                target: {
                  'protein': 180,
                  'carbohydrate': 400,
                  'fat': 90,
                },
              ),
              width: entry.value,
              scale: scale,
            ),
          );
          await tester.pumpAndSettle();

          expectFigureInsideDial(tester, figure: '1047g', dialIndex: 0);
          expectFigureInsideDial(tester, figure: '1382g', dialIndex: 1);
          expectFigureInsideDial(tester, figure: '1180g', dialIndex: 2);
        },
      );
    }
  }

  // The FULL-SIZE Today row makes the same claim at both scales and both
  // lengths — it is the variant the device report actually showed (`202g`,
  // `547g`, `193g` against the stroke on the Today dials, 2026-09-01).
  for (final scale in scales) {
    testWidgets('three-digit figures stay inside the Today dial @${scale}x', (
      tester,
    ) async {
      await tester.pumpWidget(
        wrap(
          const MacroDialRow(
            current: {'protein': 202, 'carbohydrate': 547, 'fat': 193},
            target: {'protein': 140, 'carbohydrate': 163, 'fat': 73},
          ),
          width: 366,
          scale: scale,
        ),
      );
      await tester.pumpAndSettle();

      expectFigureInsideDial(tester, figure: '202g', dialIndex: 0);
      expectFigureInsideDial(tester, figure: '547g', dialIndex: 1);
      expectFigureInsideDial(tester, figure: '193g', dialIndex: 2);
    });

    testWidgets('four-digit figures stay inside the Today dial @${scale}x', (
      tester,
    ) async {
      await tester.pumpWidget(
        wrap(
          const MacroDialRow(
            current: {'protein': 1047, 'carbohydrate': 1382, 'fat': 1180},
            target: {'protein': 140, 'carbohydrate': 163, 'fat': 73},
          ),
          width: 366,
          scale: scale,
        ),
      );
      await tester.pumpAndSettle();

      expectFigureInsideDial(tester, figure: '1047g', dialIndex: 0);
      expectFigureInsideDial(tester, figure: '1382g', dialIndex: 1);
      expectFigureInsideDial(tester, figure: '1180g', dialIndex: 2);
    });
  }

  // ── and the readouts are the size they SAY they are ──────────────────────
  //
  // Fitting inside the arc is only half the claim. [GaugeReadoutLine] takes a
  // line IN when it will not fit, so a clear-area bound that is too pessimistic
  // satisfies every assertion above by shrinking the type until it does —
  // which is exactly what shipped: the Log header's `/138g` asked for 13 and
  // rendered at an effective ~8.7, the "goals too small" of the device report.
  // At the design scale a normal three-digit day must be clamped by NOTHING.
  //
  // Measured off the rendered rect, whose height carries any `FittedBox` scale
  // the clamp applied — a shrunk line is a short one.
  void expectFullSize(
    WidgetTester tester, {
    required String figure,
    required TextStyle style,
    int index = 0,
  }) {
    final rect = tester.getRect(find.text(figure).at(index));
    expect(
      rect.height,
      closeTo(style.fontSize! * style.height!, 0.5),
      reason:
          '"$figure" rendered a ${rect.height.toStringAsFixed(1)}pt line box '
          'where ${style.fontSize} × ${style.height} was asked for — the '
          'clear-area clamp is taking in type that fits',
    );
  }

  testWidgets('a three-digit day is not clamped on either variant', (
    tester,
  ) async {
    const current = {'protein': 202, 'carbohydrate': 547, 'fat': 193};
    const target = {'protein': 140, 'carbohydrate': 163, 'fat': 73};

    await tester.pumpWidget(
      wrap(
        const Column(
          children: [
            MacroDialRow(current: current, target: target),
            SizedBox(height: 24),
            MacroDialRow.compact(current: current, target: target),
          ],
        ),
        width: 366,
        scale: 1.0,
      ),
    );
    await tester.pumpAndSettle();

    // Today row: figure 17 over denominator 12.
    expectFullSize(tester, figure: '202g', style: gaugeFigure());
    // Log header: figure 14, over the SAME denominator 12.
    expectFullSize(
      tester,
      figure: '202g',
      style: gaugeCompactFigure(),
      index: 1,
    );
    for (final denominator in ['/140g', '/163g', '/73g']) {
      expect(find.text(denominator), findsNWidgets(2));
      for (var i = 0; i < 2; i++) {
        expectFullSize(
          tester,
          figure: denominator,
          style: gaugeDenominator(),
          index: i,
        );
      }
    }
  });

  test('the clear-area maths opens up below the tips', () {
    // At the centre the whole inner circle is free.
    expect(gaugeClearHalfWidth(44, 0), closeTo(33, 0.01));
    // ABOVE the centre only the ring is in play, and its chord narrows with
    // height: √(33² − 22²).
    expect(gaugeClearHalfWidth(44, -22), closeTo(math.sqrt(33 * 33 - 484), 0.01));
    // BELOW it the 120° mouth opens, and past the tips it is the wider of the
    // two — which is why the calorie dial's third line has room to hang there.
    expect(
      gaugeClearHalfWidth(44, 40),
      closeTo(40 * math.tan(60 * math.pi / 180), 0.01),
    );
    // The band's own tip line (depth = radius/2) is already inside the mouth.
    expect(gaugeClearHalfWidth(44, 22), greaterThan(33));
  });
}
