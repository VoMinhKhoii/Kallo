import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/data/logging_models.dart';
import 'package:kallo_mobile/features/logging/logic/feed/view_state.dart';
import 'package:kallo_mobile/features/logging/widgets/feed/placeholder/loading_skeletons.dart';
import 'package:kallo_mobile/features/logging/widgets/feed/summary/macro_summary.dart';
import 'package:kallo_mobile/models/nutrition/nutrition_enums.dart';
import 'package:kallo_mobile/shared/widgets/gauge/calorie_dial.dart';
import 'package:kallo_mobile/shared/widgets/gauge/gauge_arc_geometry.dart';
import 'package:kallo_mobile/shared/widgets/gauge/macro_dial_row.dart';
import 'package:kallo_mobile/shared/widgets/gauge/rounded_gauge_arc.dart';

import '../../../../l10n_test_loader.dart';

/// iPhone 14/15 logical width — the narrow end of what this ships on.
const double _phoneWidth = 390;

/// A 320pt phone (SE). The calorie dial holds its size; the macros give way.
const double _narrowPhoneWidth = 320;

Widget _wrap(Widget child, {double textScale = 1.0, double width = _phoneWidth}) =>
    EasyLocalization(
      supportedLocales: const [Locale('en'), Locale('vi')],
      path: 'assets/l10n',
      fallbackLocale: const Locale('en'),
      assetLoader: const FsL10nLoader(),
      child: Builder(
        builder: (context) => MaterialApp(
          localizationsDelegates: context.localizationDelegates,
          supportedLocales: context.supportedLocales,
          locale: context.locale,
          home: MediaQuery(
            data: MediaQueryData(textScaler: TextScaler.linear(textScale)),
            child: Scaffold(
              // A real phone, not the 800pt test surface. The macro dials are
              // the only flexible column, so every size claim here is
              // meaningless unless the row is as tight as it is on a device.
              body: Center(
                child: SizedBox(
                  width: width,
                  child: SingleChildScrollView(child: child),
                ),
              ),
            ),
          ),
        ),
      ),
    );

FeedViewState _viewState({
  bool isLoading = false,
  bool hasUnknownDailyMacros = false,
}) => FeedViewState(
  date: '2026-01-01',
  persistedMeals: const [],
  pendingConfirmations: const [],
  entries: const [],
  isLoading: isLoading,
  hasError: false,
  hasUnknownDailyMacros: hasUnknownDailyMacros,
  isStreaming: false,
  isRevealing: false,
  isCheatRevealing: false,
  dailyCalories: 1850,
  dailyProtein: 120,
  dailyCarbs: 240,
  dailyFat: 60,
  hasFailedAttempt: false,
  isEmpty: false,
  hasLiveTail: false,
  showPartialDayNotice: false,
);

LoggingProfile _profile({MacroGoal? goal}) => LoggingProfile(
  userId: 'u1',
  calorieTarget: 2000,
  proteinTargetG: 135,
  carbsTargetG: 350,
  fatTargetG: 70,
  goal: goal,
);

Future<void> _pump(
  WidgetTester tester, {
  MacroGoal? goal,
  bool isLoading = false,
  bool hasUnknownDailyMacros = false,
  double textScale = 1.0,
  double width = _phoneWidth,
}) async {
  await tester.pumpWidget(
    _wrap(
      MacroSummary(
        view: _viewState(
          isLoading: isLoading,
          hasUnknownDailyMacros: hasUnknownDailyMacros,
        ),
        profile: _profile(goal: goal),
      ),
      textScale: textScale,
      width: width,
    ),
  );
  if (isLoading) {
    // The skeleton pulses forever; settling it never returns.
    await tester.pump();
    return;
  }
  // Drain the dials' 1000ms entrance sweep so nothing is pending at teardown.
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

  testWidgets('draws four dials: the day, then its three macros', (
    tester,
  ) async {
    await _pump(tester);

    expect(find.byType(RoundedGaugeArc), findsNWidgets(4));
    expect(find.text('120g'), findsOneWidget);
    expect(find.text('/135g'), findsOneWidget);
    expect(find.text('240g'), findsOneWidget);
    expect(find.text('/350g'), findsOneWidget);
    expect(find.text('60g'), findsOneWidget);
    expect(find.text('/70g'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('the header counts the way the user does', (tester) async {
    // No goal on the profile reads as counting UP, the same fallback the dock
    // takes — the headline is what has been logged. The unit is one word here,
    // not the dock's sentence: the compact mouth cannot hold "kcal logged", so
    // the framing moves to the line under the arc.
    await _pump(tester);
    expect(find.text('1,850'), findsOneWidget);
    expect(find.text('logged'), findsOneWidget);
    expect(find.text('1,850/2,000'), findsOneWidget);

    // A cutter counts DOWN: the headline is what is left to spend.
    await _pump(tester, goal: MacroGoal.cutting);
    expect(find.text('150'), findsOneWidget);
    expect(find.text('left'), findsOneWidget);
    expect(find.text('1,850/2,000'), findsOneWidget);
  });

  testWidgets('a macro figure sits on its arc tips', (tester) async {
    await _pump(tester);

    // The second arc is protein's — the first is the day's calorie dial.
    final arc = tester.getRect(find.byType(RoundedGaugeArc).at(1));
    final tipLine =
        arc.top +
        kCompactMacroDialRadius +
        gaugeTipOffset(kCompactMacroDialRadius);
    expect(
      tester.getRect(find.text('/135g')).center.dy,
      closeTo(tipLine, 1),
      reason: 'the secondary line and the arc tips share one line',
    );
  });

  testWidgets('holds at the Dynamic Type cap', (tester) async {
    await _pump(tester, textScale: 1.3);

    expect(find.text('120g'), findsOneWidget);
    expect(find.text('1,850'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('the macros give way on a narrow phone, the day does not', (
    tester,
  ) async {
    await _pump(tester);
    final wide = tester.getRect(find.byType(RoundedGaugeArc).at(1));
    expect(wide.width, kCompactMacroDialRadius * 2);

    await _pump(tester, width: _narrowPhoneWidth);
    final narrow = tester.getRect(find.byType(RoundedGaugeArc).at(1));
    expect(narrow.width, lessThan(kCompactMacroDialRadius * 2));
    expect(narrow.width, greaterThan(0));
    // The calorie dial is fixed: it is the row's anchor, and shrinking it would
    // put the day's own figure below its macros in prominence.
    expect(
      tester.getRect(find.byType(RoundedGaugeArc).first).width,
      kCompactCalorieDialRadius * 2,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('a day it cannot total says so instead of drawing dials', (
    tester,
  ) async {
    await _pump(tester, hasUnknownDailyMacros: true);

    expect(find.byType(RoundedGaugeArc), findsNothing);
    expect(find.textContaining('macros'), findsOneWidget);
  });

  testWidgets('stands in with the dial row\'s own silhouette while loading', (
    tester,
  ) async {
    await _pump(tester, isLoading: true);

    expect(find.byType(MacroSummarySkeleton), findsOneWidget);
    expect(find.byType(RoundedGaugeArc), findsNothing);
  });
}
