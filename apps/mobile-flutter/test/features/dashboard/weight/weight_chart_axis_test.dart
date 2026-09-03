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

    // "Start" named a range the chart does not have: with one point there is
    // no span to be at the start OF, and the tick sat under the only dot.
    test('is labelled with its own date when the server sent one', () {
      final labels = weightXTickLabels(
        pointCount: 1,
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
        dates: const ['2026-08-06'],
        locale: 'en',
        plotWidth: 2,
        style: dashMeta(),
        textScaler: TextScaler.noScaling,
      );

      expect(labels, isEmpty);
    });
  });
}
