import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/widgets/gauge/gauge_clear_area.dart';
import 'package:kallo_mobile/shared/widgets/gauge/gauge_dial.dart';
import 'package:kallo_mobile/shared/widgets/gauge/macro_dial_row.dart';
import 'package:kallo_mobile/shared/widgets/gauge/rounded_gauge_arc.dart';

import '../../../app_fonts.dart';

/// The macro figures must clear their arc by a gap the EYE can see.
///
/// `gauge_readout_fit_test.dart` proves the figure stays inside the clear area,
/// but its predicate allows touching (`<=` plus half a point of slack) and it
/// measures the line BOX, which carries side bearings the ink never reaches.
/// Both times this was reported broken from device, those assertions were green
/// — they were answering a different question from the one the user was asking.
///
/// So this file measures the rendered PIXELS: it paints the dial row, finds the
/// dark figure ink and the saturated band pigment on every row the figure
/// covers, and asserts the horizontal gap between them. That is the thing that
/// looks wrong on a phone, stated directly.
///
/// Recorded baseline, three digits at 1.0x on the Today row: 11.0-13.75pt of
/// real gap — i.e. the collision reported on 2026-09-01 did NOT reproduce. What
/// the sweep did find was four-digit figures clamped flush to the pigment
/// (2.25pt on the narrow row, 3.0pt at the Dynamic Type cap), which is what
/// [kGaugeReadoutClearMargin] now reserves against.
void main() {
  setUpAll(loadAppFonts);

  /// Every pixel row the figure covers, as (leftGap, rightGap) in points.
  ///
  /// Rendered at 4x so a quarter-point of drift is visible.
  Future<({double left, double right})> gapsFor(
    WidgetTester tester, {
    required double width,
    required double scale,
    required Map<String, int> current,
    required int dialIndex,
    required String figure,
    required bool compact,
  }) async {
    const pr = 4.0;
    tester.view.devicePixelRatio = 1.0;
    tester.view.physicalSize = const Size(420, 320);
    addTearDown(tester.view.reset);

    final key = GlobalKey();
    const target = {'protein': 140, 'carbohydrate': 163, 'fat': 73};

    await tester.pumpWidget(
      MediaQuery(
        data: MediaQueryData(textScaler: TextScaler.linear(scale)),
        child: Directionality(
          textDirection: TextDirection.ltr,
          child: RepaintBoundary(
            key: key,
            child: ColoredBox(
              // An opaque, unsaturated ground so ink and pigment classify
              // cleanly against it.
              color: const Color(0xFFFAF8F5),
              child: Center(
                child: SizedBox(
                  width: width,
                  child: compact
                      ? MacroDialRow.compact(current: current, target: target)
                      : MacroDialRow(current: current, target: target),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final boundary =
        key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
    late ui.Image image;
    late ByteData data;
    await tester.runAsync(() async {
      image = await boundary.toImage(pixelRatio: pr);
      data = (await image.toByteData(format: ui.ImageByteFormat.rawRgba))!;
    });

    final w = image.width;
    final origin = tester.getRect(find.byKey(key));

    int px(int x, int y) {
      final o = (y * w + x) * 4;
      return (data.getUint8(o) << 16) |
          (data.getUint8(o + 1) << 8) |
          data.getUint8(o + 2);
    }

    // The figure is near-black and neutral; the band is a saturated pigment.
    bool isInk(int c) {
      final r = (c >> 16) & 0xFF, g = (c >> 8) & 0xFF, b = c & 0xFF;
      final mx = [r, g, b].reduce((a, v) => a > v ? a : v);
      final mn = [r, g, b].reduce((a, v) => a < v ? a : v);
      return mx < 110 && (mx - mn) < 40;
    }

    bool isPigment(int c) {
      final r = (c >> 16) & 0xFF, g = (c >> 8) & 0xFF, b = c & 0xFF;
      final mx = [r, g, b].reduce((a, v) => a > v ? a : v);
      final mn = [r, g, b].reduce((a, v) => a < v ? a : v);
      return (mx - mn) > 45 && mx > 110;
    }

    final dial = find.byType(GaugeDial).at(dialIndex);
    final arcBox = tester.getRect(
      find.descendant(of: dial, matching: find.byType(RoundedGaugeArc)),
    );
    final textRect = tester.getRect(find.text(figure));

    var left = double.infinity, right = double.infinity;
    var inkRows = 0;
    final x0 = ((arcBox.left - 4) * pr).floor();
    final x1 = ((arcBox.right + 4) * pr).ceil();

    for (
      var y = (textRect.top * pr).floor();
      y <= (textRect.bottom * pr).ceil();
      y++
    ) {
      final py = y - (origin.top * pr).round();
      if (py < 0 || py >= image.height) continue;

      int? inkL, inkR;
      for (var x = x0; x <= x1; x++) {
        final sx = x - (origin.left * pr).round();
        if (sx < 0 || sx >= w) continue;
        if (isInk(px(sx, py))) {
          inkL ??= x;
          inkR = x;
        }
      }
      if (inkL == null) continue;
      inkRows++;

      for (var x = inkL; x >= x0; x--) {
        final sx = x - (origin.left * pr).round();
        if (sx < 0 || sx >= w) continue;
        if (isPigment(px(sx, py))) {
          left = (inkL - x) / pr < left ? (inkL - x) / pr : left;
          break;
        }
      }
      for (var x = inkR!; x <= x1; x++) {
        final sx = x - (origin.left * pr).round();
        if (sx < 0 || sx >= w) continue;
        if (isPigment(px(sx, py))) {
          right = (x - inkR) / pr < right ? (x - inkR) / pr : right;
          break;
        }
      }
    }

    // Guards the measurement itself: if the classifier stopped finding the
    // figure, an empty scan would otherwise report an infinite gap and pass.
    expect(
      inkRows,
      greaterThan(4),
      reason: 'found no figure ink for "$figure" — the probe is broken',
    );
    return (left: left, right: right);
  }

  const threeDigit = {'protein': 202, 'carbohydrate': 547, 'fat': 193};
  const fourDigit = {'protein': 1047, 'carbohydrate': 1382, 'fat': 1180};

  // 366 is the Today row on a 390pt phone, 320 the narrowest phone we target,
  // 214 what the Log header leaves the compact dials.
  const cases = <({double width, bool compact})>[
    (width: 366, compact: false),
    (width: 320, compact: false),
    (width: 214, compact: true),
  ];

  for (final c in cases) {
    for (final scale in [1.0, 1.3]) {
      for (final digits in [3, 4]) {
        final current = digits == 3 ? threeDigit : fourDigit;
        final figures = current.values.map((v) => '${v}g').toList();
        final name =
            '${c.compact ? "compact" : "full"} dials keep '
            '${kGaugeReadoutClearMargin}pt of air at ${c.width}pt, '
            '${scale}x, $digits digits';

        testWidgets(name, (tester) async {
          for (var i = 0; i < figures.length; i++) {
            final gaps = await gapsFor(
              tester,
              width: c.width,
              scale: scale,
              current: current,
              dialIndex: i,
              figure: figures[i],
              compact: c.compact,
            );
            for (final side in [('left', gaps.left), ('right', gaps.right)]) {
              expect(
                side.$2,
                greaterThanOrEqualTo(kGaugeReadoutClearMargin),
                reason:
                    '"${figures[i]}" leaves only ${side.$2}pt on its ${side.$1} '
                    'before the band pigment starts — the figure reads as '
                    'touching its own arc',
              );
            }
          }
        });
      }
    }
  }
}
