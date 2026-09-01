import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/nutrition/widgets/summary/day_summary.dart';
import 'package:kallo_mobile/models/nutrition/nutrition.dart';

import '../../l10n_test_loader.dart';

/// Wraps a widget in the minimal localization + Material scaffolding the
/// `DaySummary` needs. It takes plain data params, so no ProviderScope/Supabase.
Widget _wrap(Widget child) => EasyLocalization(
      supportedLocales: const [Locale('en'), Locale('vi')],
      path: 'assets/l10n',
      fallbackLocale: const Locale('en'),
      assetLoader: const FsL10nLoader(),
      child: Builder(
        builder: (context) => MaterialApp(
          localizationsDelegates: context.localizationDelegates,
          supportedLocales: context.supportedLocales,
          locale: context.locale,
          home: Scaffold(body: child),
        ),
      ),
    );

CalorieAverages _averages({double? complete = 2000, double? all = 350}) =>
    CalorieAverages(
      all: CalorieScopeAverage(averagePerDay: all, days: 14),
      complete: CalorieScopeAverage(averagePerDay: complete, days: 9),
    );

DaySummary _daySummary({
  required NutritionDayScope scope,
  required CalorieAverages averages,
  List<MacroPattern> macros = const [],
  ValueChanged<NutritionDayScope>? onScopeChange,
  int? selectedIndex,
  bool isEmpty = false,
}) =>
    DaySummary(
      macros: macros,
      resolvedRange: '7d',
      daySeries: const NutritionDaySeries(unit: 'day', series: []),
      calorieAverages: averages,
      // Nothing logged in the window before — no delta to draw.
      previousCalorieAverages: const CalorieAverages(
        all: CalorieScopeAverage(averagePerDay: null, days: 0),
        complete: CalorieScopeAverage(averagePerDay: null, days: 0),
      ),
      scope: scope,
      onScopeChange: onScopeChange ?? (_) {},
      dateSpan: '10 – 16 Aug 2026',
      todayIndex: -1,
      selectedIndex: selectedIndex,
      onSelect: (_) {},
      isEmpty: isEmpty,
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    // EasyLocalization.ensureInitialized reads SharedPreferences; stub the
    // platform channel so it resolves in the test's fake-async zone.
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/shared_preferences'),
      (call) async => call.method == 'getAll' ? <String, Object>{} : null,
    );
    await EasyLocalization.ensureInitialized();
  });

  testWidgets('shows the active scope and names the other one', (tester) async {
    await tester.pumpWidget(
      _wrap(
        _daySummary(
          scope: NutritionDayScope.complete,
          averages: _averages(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // One figure, in plain kcal, with the dates it covers under it.
    expect(find.text('2,000'), findsOneWidget);
    expect(find.text('10 – 16 Aug 2026'), findsOneWidget);
    // The other scope is offered by NAME rather than shown as a loose number.
    expect(find.text('350'), findsNothing);
    expect(find.text('All'), findsOneWidget);
  });

  testWidgets('the switch moves to the scope it names', (tester) async {
    NutritionDayScope? promoted;
    await tester.pumpWidget(
      _wrap(
        _daySummary(
          scope: NutritionDayScope.complete,
          averages: _averages(),
          onScopeChange: (scope) => promoted = scope,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('All'));
    await tester.pump();

    expect(promoted, NutritionDayScope.all);
  });

  testWidgets('on logged days the switch points back to complete',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        _daySummary(
          scope: NutritionDayScope.all,
          averages: _averages(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('350'), findsOneWidget);
    expect(find.text('Complete days'), findsOneWidget);
  });

  testWidgets('complete scope with no complete days reads as a dash',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        _daySummary(
          scope: NutritionDayScope.complete,
          averages: _averages(complete: null),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // The dash says it, and the switch offers the way out by naming the other
    // scope.
    expect(find.text('—'), findsOneWidget);
    expect(find.text('All'), findsOneWidget);
  });

  // The complete-day rule, ported from the web card. Same three conditions:
  // the COMPLETE scope only, no column selected, something logged.
  const hintStart = 'Only days logging at least 85%';

  testWidgets('names the 85% rule under the complete-scope figure', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        _daySummary(
          scope: NutritionDayScope.complete,
          averages: _averages(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final hint = find.textContaining(hintStart);
    expect(hint, findsOneWidget);
    // The note names the OTHER scope with the SAME label the switch uses, so
    // the two cannot drift: no raw placeholder survives to the screen.
    expect(tester.widget<Text>(hint).data, contains('\u201cAll\u201d'));
    expect(tester.widget<Text>(hint).data, isNot(contains('{allLabel}')));
  });

  testWidgets('drops the rule on All, where nothing is set aside', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        _daySummary(scope: NutritionDayScope.all, averages: _averages()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining(hintStart), findsNothing);
  });

  testWidgets('drops the rule for a selected column and an empty range', (
    tester,
  ) async {
    for (final variant in [
      _daySummary(
        scope: NutritionDayScope.complete,
        averages: _averages(),
        selectedIndex: 2,
      ),
      _daySummary(
        scope: NutritionDayScope.complete,
        averages: _averages(),
        isEmpty: true,
      ),
    ]) {
      await tester.pumpWidget(_wrap(variant));
      await tester.pumpAndSettle();
      expect(find.textContaining(hintStart), findsNothing);
    }
  });
}
