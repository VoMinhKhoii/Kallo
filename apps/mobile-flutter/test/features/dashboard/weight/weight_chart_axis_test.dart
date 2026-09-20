import 'dart:convert';
import 'dart:io';

// Not re-exported by the package's public library, but this is the only way to
// prime `tr()` without booting a widget tree for a pure-function test.
import 'package:easy_localization/src/localization.dart';
import 'package:easy_localization/src/translations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'package:kallo_mobile/features/dashboard/logic/weight_chart_axis.dart';
import 'package:kallo_mobile/theme/calm_tokens.dart';

/// [niceYAxis] is a pure, public function that exists to be reasoned about
/// without a chart on screen — so it has to answer for the empty series on its
/// own rather than leaning on `WeightChart` checking `weights.isEmpty` before
/// it paints. `reduce` throws on an empty list, and that guard is one refactor
/// of the caller away from being gone.
void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    // `EasyLocalization` does this for the app; a pure-function test has to.
    await initializeDateFormatting('en');
    Localization.load(
      const Locale('en'),
      translations: Translations(
        json.decode(File('assets/l10n/en.json').readAsStringSync())
            as Map<String, dynamic>,
      ),
    );
  });

  test('an empty series still yields a usable band', () {
    final axis = niceYAxis(const []);

    expect(axis.step, greaterThan(0));
    expect(axis.max, greaterThan(axis.min));
    // The same three-step floor every other series gets, so the chart is never
    // asked to scale a zero-height domain.
    expect(axis.max - axis.min, greaterThanOrEqualTo(axis.step * 3 - 1e-9));
  });

  test('a single point sits inside its band, not on an edge', () {
    final axis = niceYAxis(const [65.9]);

    expect(axis.min, lessThan(65.9));
    expect(axis.max, greaterThan(65.9));
  });

  group('one logged weight', () {
    // "Start" named a range the chart does not have: with one point there is
    // no span to be at the start OF, and the tick sat under the only dot.
    test('is labelled with its own date when the server sent one', () {
      final labels = weightXTickLabels(
        pointCount: 1,
        offsets: const [0],
        dates: const ['2026-08-06'],
        locale: 'en',
        plotWidth: 300,
        style: dashMeta(),
        textScaler: TextScaler.noScaling,
      );

      expect(labels, {0: '6/8'});
    });

    test('falls back to "Now" when the server sent no dates', () {
      final labels = weightXTickLabels(
        pointCount: 1,
        offsets: const [0],
        dates: const [],
        locale: 'en',
        plotWidth: 300,
        style: dashMeta(),
        textScaler: TextScaler.noScaling,
      );

      expect(labels, {0: 'Now'});
    });

    // The single-point branch used to skip the width guard entirely, so its
    // label was the one tick that could be wider than the plot it sits under.
    test('is dropped, not clipped, when the plot cannot hold it', () {
      final labels = weightXTickLabels(
        pointCount: 1,
        offsets: const [0],
        dates: const ['2026-08-06'],
        locale: 'en',
        plotWidth: 2,
        style: dashMeta(),
        textScaler: TextScaler.noScaling,
      );

      expect(labels, isEmpty);
    });
  });

  group('weightDayOffsets', () {
    test('places readings on their calendar day, so a gap stays a gap', () {
      expect(
        weightDayOffsets(const ['2026-08-28', '2026-09-08', '2026-09-19'], 3),
        const [0, 11, 22],
      );
    });

    test('keeps unequal gaps unequal', () {
      final offsets = weightDayOffsets(const [
        '2026-08-28',
        '2026-08-30',
        '2026-09-19',
      ], 3);
      expect(offsets[1] - offsets[0], 2);
      expect(offsets[2] - offsets[1], 20);
    });

    test('crosses a DST boundary without losing a day', () {
      // Local midnights 31 days apart are 30d23h when the clocks go back, and
      // Duration.inDays truncates — so the arithmetic runs in UTC.
      expect(weightDayOffsets(const ['2026-10-20', '2026-11-20'], 2), const [
        0,
        31,
      ]);
    });

    test('falls back to positions rather than mixing coordinate systems', () {
      // One unparseable date used to give [0, 59, 2] — a day offset, another
      // day offset, then a list position.
      expect(
        weightDayOffsets(const ['2026-01-01', '2026-03-01', 'garbage'], 3),
        const [0, 1, 2],
      );
    });

    test('falls back to positions when the series runs backwards', () {
      expect(
        weightDayOffsets(const ['2026-09-01', '2026-09-20', '2026-09-10'], 3),
        const [0, 1, 2],
      );
    });

    test('falls back to list positions when the server sent no dates', () {
      expect(weightDayOffsets(const [], 3), const [0, 1, 2]);
      expect(weightDayOffsets(const ['2026-08-28'], 3), const [0, 1, 2]);
    });

    test('has nothing to offset for no readings', () {
      expect(weightDayOffsets(const [], 0), isEmpty);
    });
  });

  group('x tick labels', () {
    test('are keyed by day offset, matching the chart x values', () {
      final labels = weightXTickLabels(
        pointCount: 3,
        offsets: const [0, 11, 22],
        dates: const ['2026-08-28', '2026-09-08', '2026-09-19'],
        locale: 'en',
        plotWidth: 300,
        style: dashMeta(),
        textScaler: TextScaler.noScaling,
      );

      // Keys are days, not indices 0/1/2 — the newest one carries "Now".
      expect(labels.keys, containsAll(const [0, 22]));
      expect(labels[0], '28/8');
      expect(labels[22], 'Now');
    });

    // Four weigh-ins on the 28th, 29th, 30th and the 19th: keying ticks to the
    // READINGS put three ~29px labels inside 23px of plot, because the width
    // guard divides the plot evenly by the tick count. Ticks are spaced across
    // the day span instead, which is what makes that guard true.
    test('does not crowd when readings cluster at one end', () {
      const offsets = [0, 1, 2, 22];
      const plotWidth = 311.0;
      final labels = weightXTickLabels(
        pointCount: 4,
        offsets: offsets,
        dates: const ['2026-08-28', '2026-08-29', '2026-08-30', '2026-09-19'],
        locale: 'en',
        plotWidth: plotWidth,
        style: dashMeta(),
        textScaler: TextScaler.noScaling,
      );

      final keys = labels.keys.toList()..sort();
      final pxPerDay = plotWidth / 22;
      for (var i = 1; i < keys.length; i++) {
        expect(
          (keys[i] - keys[i - 1]) * pxPerDay,
          greaterThan(20),
          reason: 'ticks $keys collide once scaled to pixels',
        );
      }
    });

    test('labels a tick by its date even when nothing was logged that day', () {
      final labels = weightXTickLabels(
        pointCount: 2,
        offsets: const [0, 20],
        dates: const ['2026-08-28', '2026-09-17'],
        locale: 'en',
        plotWidth: 300,
        style: dashMeta(),
        textScaler: TextScaler.noScaling,
      );

      // A tick names a date; the dots carry where the readings are.
      expect(labels[0], '28/8');
      expect(labels[20], 'Now');
    });

    test('never invents a week number when the dates are missing', () {
      final labels = weightXTickLabels(
        pointCount: 3,
        offsets: const [0, 1, 2],
        dates: const [],
        locale: 'en',
        plotWidth: 300,
        style: dashMeta(),
        textScaler: TextScaler.noScaling,
      );

      expect(labels.values, everyElement(anyOf('Start', 'Now')));
    });
  });
}
