import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/widgets/gauge/macro_dial_row.dart';
import 'package:kallo_mobile/shared/widgets/gauge/gauge_arc_geometry.dart';
import 'package:kallo_mobile/shared/widgets/gauge/rounded_gauge_arc.dart';

import '../../../l10n_test_loader.dart';

/// The dock's real width on a 390pt phone, less the page's 16pt inset.
const double _dockWidth = 358;

const _current = {'protein': 42, 'carbohydrate': 96, 'fat': 21};
const _target = {'protein': 140, 'carbohydrate': 220, 'fat': 62};

Widget _wrap(
  Widget child, {
  double textScale = 1.0,
  double width = _dockWidth,
}) => EasyLocalization(
  supportedLocales: const [Locale('en')],
  path: 'assets/l10n',
  fallbackLocale: const Locale('en'),
  assetLoader: const FsL10nLoader(),
  child: Builder(
    builder:
        (context) => MaterialApp(
          localizationsDelegates: context.localizationDelegates,
          supportedLocales: context.supportedLocales,
          locale: context.locale,
          home: MediaQuery(
            data: MediaQueryData(textScaler: TextScaler.linear(textScale)),
            child: Scaffold(
              body: Center(child: SizedBox(width: width, child: child)),
            ),
          ),
        ),
  ),
);

/// Drain the dials' entrance sweep so nothing is left pending at teardown.
Future<void> _pump(
  WidgetTester tester, {
  double textScale = 1.0,
  double width = _dockWidth,
}) async {
  await tester.pumpWidget(
    _wrap(
      const MacroDialRow(current: _current, target: _target),
      textScale: textScale,
      width: width,
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/shared_preferences'),
          (call) async => call.method == 'getAll' ? <String, Object>{} : null,
        );
    await EasyLocalization.ensureInitialized();
  });

  testWidgets('shows each macro against its target, named by the row', (
    tester,
  ) async {
    await _pump(tester);
    // The row reads its own labels — a caller hands over figures, not copy.
    expect(find.text('PROTEIN'), findsOneWidget);
    expect(find.text('CARBS'), findsOneWidget);
    expect(find.text('FAT'), findsOneWidget);
    expect(find.text('42g'), findsOneWidget);
    expect(find.text('/140g'), findsOneWidget);
    expect(find.text('96g'), findsOneWidget);
    expect(find.text('/220g'), findsOneWidget);
    expect(find.text('21g'), findsOneWidget);
    expect(find.text('/62g'), findsOneWidget);
  });

  testWidgets('sits the target line on the arc tips', (tester) async {
    await _pump(tester);
    final arc = tester.getRect(find.byType(RoundedGaugeArc).first);
    // The dial is drawn with its arc flush to the top of its box, so the tips
    // are one radius down plus the drop to them.
    final tipLine =
        arc.top + kMacroDialRadius + gaugeTipOffset(kMacroDialRadius);
    expect(
      tester.getRect(find.text('/140g')).center.dy,
      closeTo(tipLine, 1),
      reason: 'the secondary line and the arc tips share one line',
    );
  });

  testWidgets('holds that alignment at the 1.3 Dynamic Type cap', (
    tester,
  ) async {
    await _pump(tester, textScale: 1.3);
    final arc = tester.getRect(find.byType(RoundedGaugeArc).first);
    final tipLine =
        arc.top + kMacroDialRadius + gaugeTipOffset(kMacroDialRadius);
    expect(tester.getRect(find.text('/140g')).center.dy, closeTo(tipLine, 1));
    expect(tester.takeException(), isNull);
  });

  testWidgets('fits the narrowest phone at full size', (tester) async {
    // 320pt — the smallest screen the app supports — less the 16pt page inset.
    // Three full-size dials and their two gutters land just inside it.
    await _pump(tester, width: 288);
    expect(tester.takeException(), isNull);
    final arc = tester.getRect(find.byType(RoundedGaugeArc).first);
    expect(arc.width, kMacroDialRadius * 2);
  });

  testWidgets('shrinks rather than overflowing when narrower still', (
    tester,
  ) async {
    await _pump(tester, width: 240);
    expect(tester.takeException(), isNull);
    final arc = tester.getRect(find.byType(RoundedGaugeArc).first);
    expect(arc.width, lessThan(kMacroDialRadius * 2));
    expect(arc.width, greaterThan(0));
  });
}
