import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:nham_mobile/features/dashboard/logic/dashboard_spacing.dart';
import 'package:nham_mobile/features/dashboard/widgets/today_macro_rows.dart';
import 'package:nham_mobile/theme/calm_tokens.dart';
import 'package:nham_mobile/theme/nham_colors.dart';

Widget _wrap(Widget child, {double textScale = 1.0}) => MaterialApp(
  home: MediaQuery(
    data: MediaQueryData(textScaler: TextScaler.linear(textScale)),
    // The real dock is a card of finite width; the readout's whole job is to
    // stay inside it.
    child: Scaffold(body: Center(child: SizedBox(width: 320, child: child))),
  ),
);

double _renderedWidth(String text, {double textScale = 1.0}) {
  final painter = TextPainter(
    text: TextSpan(text: text, style: dashMeta(tabular: true)),
    textDirection: ui.TextDirection.ltr,
    textScaler: TextScaler.linear(textScale),
    maxLines: 1,
  )..layout();
  return painter.width;
}

/// One `dashMeta` line is 12 / 1.25 = 15; a wrapped value is 30+.
const _oneLineMax = 22.0;

/// Pump a row and drain its entrance: the bar schedules a `Future.delayed`
/// lead-in before sweeping, which would otherwise be left pending at teardown.
Future<void> _pumpRow(
  WidgetTester tester,
  MacroBarData bar, {
  double textScale = 1.0,
}) async {
  await tester.pumpWidget(
    _wrap(MacroRow(bar: bar, idx: 0), textScale: textScale),
  );
  await tester.pump(const Duration(milliseconds: 300));
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    // Measure against the real typeface — the test font's glyphs are all one em
    // wide, which would make any width claim meaningless.
    final loader = FontLoader('BeVietnamPro')..addFont(
      File(
        'assets/google_fonts/BeVietnamPro-Regular.ttf',
      ).readAsBytes().then(ByteData.sublistView),
    );
    await loader.load();
  });

  const threeDigit = MacroBarData('CARBS', 120, 135, NhamColors.macroCarbs);
  const fourDigit = MacroBarData('CARBS', 1024, 350, NhamColors.macroCarbs);

  testWidgets('keeps a three-digit value on one line', (tester) async {
    await _pumpRow(tester, threeDigit);

    expect(
      tester.getSize(find.text('120/135g')).height,
      lessThan(_oneLineMax),
      reason: '120/135g wrapped onto a second line',
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('holds one line at the 1.3 Dynamic Type cap', (tester) async {
    await _pumpRow(tester, fourDigit, textScale: 1.3);

    expect(
      tester.getSize(find.text('1024/350g')).height,
      lessThan(_oneLineMax * 1.3),
      reason: 'the readout wrapped once Dynamic Type was raised',
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('scales down rather than truncating the widest figure', (
    tester,
  ) async {
    await _pumpRow(tester, fourDigit);

    // Without the FittedBox this clips, and "1024/350g" cut to "1024/35" reads
    // as a real but wrong number.
    expect(
      _renderedWidth('1024/350g', textScale: 1.3),
      greaterThan(dashboardValueColumnWidth),
      reason: 'if this ever fits, the scale-down is no longer load-bearing',
    );
    expect(
      find.ancestor(
        of: find.text('1024/350g'),
        matching: find.byWidgetPredicate(
          (w) => w is FittedBox && w.fit == BoxFit.scaleDown,
        ),
      ),
      findsOneWidget,
    );
  });

  test('the column fits the widest realistic figure at normal scale', () {
    expect(
      _renderedWidth('1024/350g'),
      lessThanOrEqualTo(dashboardValueColumnWidth),
      reason: 'the shared value column is too narrow to read',
    );
  });
}
