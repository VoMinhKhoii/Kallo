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
import 'package:kallo_mobile/shared/widgets/gauge/gauge_clear_area.dart';
import 'package:kallo_mobile/shared/widgets/gauge/macro_dial_row.dart';
import 'package:kallo_mobile/shared/widgets/gauge/rounded_gauge_arc.dart';

import '../../../../app_fonts.dart';
import '../../../../l10n_test_loader.dart';

/// iPhone 14/15 logical width — the narrow end of what this ships on.
const double _phoneWidth = 390;

/// A 320pt phone (SE). The calorie dial holds its size; the macros give way.
const double _narrowPhoneWidth = 320;

Widget _wrap(
  Widget child, {
  double textScale = 1.0,
  double width = _phoneWidth,
  Locale locale = const Locale('en'),
}) => EasyLocalization(
  supportedLocales: const [Locale('en'), Locale('vi')],
  startLocale: locale,
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
  Set<String> incompleteTotals = const {},
}) => FeedViewState(
  date: '2026-01-01',
  persistedMeals: const [],
  pendingConfirmations: const [],
  entries: const [],
  isLoading: isLoading,
  hasError: false,
  incompleteTotals: incompleteTotals,
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
  Set<String> incompleteTotals = const {},
  double textScale = 1.0,
  double width = _phoneWidth,
  Locale locale = const Locale('en'),
}) async {
  await tester.pumpWidget(
    _wrap(
      MacroSummary(
        view: _viewState(
          isLoading: isLoading,
          incompleteTotals: incompleteTotals,
        ),
        profile: _profile(goal: goal),
      ),
      textScale: textScale,
      width: width,
      locale: locale,
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
    // The header's words are measured against the arc (the unit's fit test)
    // and against the macro columns, so the real font is load-bearing here.
    await loadAppFonts();
  });

  /// How far the calorie dial's unit stays clear of its own arc's band, each
  /// side — negative means it runs into the tips.
  double unitClearance(WidgetTester tester, String unit) {
    final arc = tester.getRect(find.byType(RoundedGaugeArc).first);
    final line = tester.getRect(find.text(unit));
    final centreY = arc.top + kCompactCalorieDialRadius;
    final half = gaugeClearHalfWidthForBand(
      kCompactCalorieDialRadius,
      line.top - centreY,
      line.bottom - centreY,
    );
    return half - (line.center.dx - arc.center.dx).abs() - line.width / 2;
  }

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
    // takes — the headline is what has been logged, and the fraction under the
    // arc leads with that same figure, so it needs no verb.
    await _pump(tester);
    expect(find.text('1,850'), findsOneWidget);
    expect(find.text('Kcal eaten'), findsOneWidget);
    expect(find.text('1,850/2,000'), findsOneWidget);

    // A cutter counts DOWN: the headline is what is left to spend, and the
    // fraction carries its own verb so it cannot borrow the unit above it.
    await _pump(tester, goal: MacroGoal.cutting);
    expect(find.text('150'), findsOneWidget);
    expect(find.text('Kcal left'), findsOneWidget);
    expect(find.text('Ate 1,850/2,000'), findsOneWidget);
  });

  // The on-device misread (2026-09-27): "1.014 / còn lại / 918/1.932" was
  // read as "ate 1.014, còn lại 918/1.932" — the grey unit word bound DOWN to
  // a bare grey fraction. The unit now names the figure in full, in ink, and
  // the fraction says what it is.
  testWidgets('a Vietnamese cutter reads what is left, then what was logged', (
    tester,
  ) async {
    await _pump(tester, goal: MacroGoal.cutting, locale: const Locale('vi'));
    expect(find.text('150'), findsOneWidget);
    expect(find.text('Kcal còn lại'), findsOneWidget);
    expect(find.text('Đã ghi 1.850/2.000'), findsOneWidget);
    expect(find.text('1.850/2.000'), findsNothing);
  });

  testWidgets('the unit sentence clears the arc tips', (tester) async {
    await _pump(tester, goal: MacroGoal.cutting, locale: const Locale('vi'));
    // 2.5pt measured; the fit test holds it to at least the unit margin.
    expect(
      unitClearance(tester, 'Kcal còn lại'),
      greaterThanOrEqualTo(kGaugeUnitClearMargin - 0.01),
    );
  });

  testWidgets('a text scale too large for the sentence falls back to a word', (
    tester,
  ) async {
    // At 1.3x "Kcal còn lại" would run ~7.6pt into the tips. The dial says the
    // one word instead of crossing its own arc.
    await _pump(
      tester,
      goal: MacroGoal.cutting,
      locale: const Locale('vi'),
      textScale: 1.3,
    );
    expect(find.text('Kcal còn lại'), findsNothing);
    expect(find.text('Còn lại'), findsOneWidget);
    expect(unitClearance(tester, 'Còn lại'), greaterThan(0));
    expect(tester.takeException(), isNull);
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
    // The calorie dial steps down to its floor rather than taking the macros'
    // room — and no further: it is the row's anchor, and shrinking it more
    // would put the day's own figure below its macros in prominence.
    expect(
      tester.getRect(find.byType(RoundedGaugeArc).first).width,
      kCompactCalorieDialMinRadius * 2,
    );
    expect(tester.takeException(), isNull);
  });

  // Review of #396: at 320pt and the 1.3 cap, "Đã ghi 1.850/2.000" measured
  // ~150pt, widened the calorie dial, and squeezed the macro dials to ~r21,
  // where their figures scaled to nothing. The dial now drops the verb (and
  // its radius) before it takes the macros' room.
  testWidgets('the verb never costs the macro figures their room', (
    tester,
  ) async {
    for (final width in [_narrowPhoneWidth, _phoneWidth]) {
      await _pump(
        tester,
        goal: MacroGoal.cutting,
        locale: const Locale('vi'),
        textScale: 1.3,
        width: width,
      );
      expect(find.text('Đã ghi 1.850/2.000'), findsNothing);
      expect(find.text('1.850/2.000'), findsOneWidget);
      final calorie = tester.getSize(find.byType(CalorieDial)).width;
      expect(calorie, lessThanOrEqualTo(kCompactCalorieDialRadius * 2));
      for (final figure in ['120g', '240g', '60g']) {
        expect(
          tester.getRect(find.text(figure)).width,
          greaterThan(0),
          reason: '$figure scaled away at ${width}pt',
        );
      }
      expect(tester.takeException(), isNull);
    }
    // On a phone with room for it the macro dials hold their full size.
    expect(
      tester.getRect(find.byType(RoundedGaugeArc).at(1)).width,
      kCompactMacroDialRadius * 2,
    );
  });

  testWidgets('a narrow phone keeps the header it had before the sentence', (
    tester,
  ) async {
    // 320pt cannot spare 116 for the dial, so it keeps its old 52 radius, the
    // one-word unit and the bare fraction: the macros keep their old room.
    await _pump(
      tester,
      goal: MacroGoal.cutting,
      locale: const Locale('vi'),
      width: _narrowPhoneWidth,
    );
    expect(find.text('Còn lại'), findsOneWidget);
    expect(find.text('1.850/2.000'), findsOneWidget);
    expect(
      tester.getSize(find.byType(CalorieDial)).width,
      kCompactCalorieDialMinRadius * 2,
    );
  });

  testWidgets('a total missing a meal\'s value still draws, as a floor', (
    tester,
  ) async {
    // One label that never listed protein used to blank the whole header.
    await _pump(tester, incompleteTotals: {'protein'});

    expect(find.byType(RoundedGaugeArc), findsNWidgets(4));
    expect(find.text('≥120g'), findsOneWidget);
    expect(find.text('240g'), findsOneWidget);
    expect(find.text('1,850'), findsOneWidget);
  });

  testWidgets('an incomplete calorie total is a ceiling on what is left', (
    tester,
  ) async {
    await _pump(
      tester,
      goal: MacroGoal.cutting,
      incompleteTotals: {'calories'},
    );

    expect(find.text('≤150'), findsOneWidget);
  });

  testWidgets('stands in with the dial row\'s own silhouette while loading', (
    tester,
  ) async {
    await _pump(tester, isLoading: true);

    expect(find.byType(MacroSummarySkeleton), findsOneWidget);
    expect(find.byType(RoundedGaugeArc), findsNothing);
  });
}
