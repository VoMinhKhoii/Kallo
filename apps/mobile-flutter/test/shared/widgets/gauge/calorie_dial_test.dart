import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/shared/widgets/gauge/calorie_dial.dart';
import 'package:kallo_mobile/models/nutrition/nutrition_enums.dart';

import '../../../l10n_test_loader.dart';

Widget _wrap(Widget child) => EasyLocalization(
  supportedLocales: const [Locale('en')],
  path: 'assets/l10n',
  fallbackLocale: const Locale('en'),
  assetLoader: const FsL10nLoader(),
  child: Builder(
    builder: (context) => MaterialApp(
      localizationsDelegates: context.localizationDelegates,
      supportedLocales: context.supportedLocales,
      locale: context.locale,
      home: Scaffold(body: Center(child: SizedBox(width: 358, child: child))),
    ),
  ),
);

Future<void> _pump(
  WidgetTester tester, {
  required double logged,
  required MacroGoal? goal,
}) async {
  await tester.pumpWidget(
    _wrap(
      CalorieDial(logged: logged, target: 2000, goal: goal),
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

  testWidgets('cutting counts DOWN — the headline is what is left', (
    tester,
  ) async {
    await _pump(tester, logged: 741, goal: MacroGoal.cutting);
    expect(find.text('1,259'), findsOneWidget);
    expect(find.text('kcal remaining'), findsOneWidget);
    // What was eaten is still on screen, just demoted.
    expect(find.text('741/2,000 logged'), findsOneWidget);
  });

  testWidgets('bulking counts UP — the headline is what was eaten', (
    tester,
  ) async {
    await _pump(tester, logged: 741, goal: MacroGoal.bulking);
    expect(find.text('741'), findsOneWidget);
    expect(find.text('kcal logged'), findsOneWidget);
    expect(find.text('1,259/2,000 left'), findsOneWidget);
  });

  testWidgets('an unset goal counts up, like maintaining', (tester) async {
    await _pump(tester, logged: 741, goal: null);
    expect(find.text('741'), findsOneWidget);
    expect(find.text('kcal logged'), findsOneWidget);
  });

  testWidgets('a cutter past target reads 0, never a negative', (tester) async {
    await _pump(tester, logged: 2341, goal: MacroGoal.cutting);
    expect(find.text('0'), findsOneWidget);
    expect(find.text('-341'), findsNothing);
    expect(find.text('−341'), findsNothing);
    // The overshoot is not hidden — it is carried by the line underneath.
    expect(find.text('2,341/2,000 logged'), findsOneWidget);
  });

  testWidgets('a bulker past target is told by how much', (tester) async {
    await _pump(tester, logged: 2341, goal: MacroGoal.bulking);
    expect(find.text('2,341'), findsOneWidget);
    expect(find.text('341 over 2,000'), findsOneWidget);
  });

  testWidgets('the layout does not shift when the goal flips', (tester) async {
    await _pump(tester, logged: 741, goal: MacroGoal.cutting);
    final cutting = tester.getSize(find.byType(CalorieDial));
    await _pump(tester, logged: 741, goal: MacroGoal.bulking);
    expect(tester.getSize(find.byType(CalorieDial)), cutting);
  });
}
