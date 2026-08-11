import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:nham_mobile/features/nutrition/widgets/day_summary.dart';
import 'package:nham_mobile/models/nutrition.dart';

import 'l10n_test_loader.dart';

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
}) =>
    DaySummary(
      macros: macros,
      resolvedRange: '7d',
      daySeries: const NutritionDaySeries(unit: 'day', series: []),
      calorieAverages: averages,
      scope: scope,
      onScopeChange: onScopeChange ?? (_) {},
      dateSpan: 'May 4 – May 10, 2026',
      todayIndex: -1,
      selectedIndex: null,
      onSelect: (_) {},
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

  testWidgets('shows both averages with Complete as the hero by default',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        _daySummary(
          scope: NutritionDayScope.complete,
          averages: _averages(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Both averages are on screen at once.
    expect(find.text('2,000'), findsOneWidget);
    expect(find.text('350'), findsOneWidget);
    // The unit line carries the denominator, so neither figure is a bare
    // number, and each states the dates it covers underneath.
    expect(find.textContaining('kcal per complete day'), findsOneWidget);
    expect(find.textContaining('kcal per logged day'), findsOneWidget);
    expect(find.text('May 4 – May 10, 2026'), findsNWidgets(2));
  });

  testWidgets('tapping the subtle secondary promotes that scope',
      (tester) async {
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

    // The "all" average is the secondary here; tapping it promotes 'all'.
    await tester.tap(find.text('350'));
    await tester.pump();

    expect(promoted, NutritionDayScope.all);
  });

  testWidgets('complete scope with no complete days shows the empty hint',
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

    // Hero (complete) has no value; the all average is still shown.
    expect(find.text('—'), findsOneWidget);
    expect(find.text('350'), findsOneWidget);
    expect(find.textContaining('No fully-logged days yet'), findsOneWidget);
  });
}
