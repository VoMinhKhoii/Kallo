import 'dart:io';
import 'dart:math' as math;

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:kallo_mobile/features/dashboard/screens/dashboard_screen.dart';
import 'package:kallo_mobile/features/logging/data/logging_models.dart';
import 'package:kallo_mobile/features/logging/data/logging_providers.dart';
import 'package:kallo_mobile/features/logging/logic/days/log_calendar.dart';
import 'package:kallo_mobile/features/logging/logic/days/this_week.dart';
import 'package:kallo_mobile/features/logging/screens/logging_screen.dart';
import 'package:kallo_mobile/features/logging/widgets/days/log_calendar_day.dart';
import 'package:kallo_mobile/features/logging/widgets/days/log_day_row.dart';
import 'package:kallo_mobile/features/logging/widgets/days/log_days_pane.dart';
import 'package:kallo_mobile/features/logging/widgets/feed/feed_area.dart';
import 'package:kallo_mobile/features/nutrition/screens/nutrition_screen.dart';
import 'package:kallo_mobile/shared/widgets/feedback/kallo_refresh.dart';
import 'package:kallo_mobile/shared/widgets/sheet/kallo_sheet.dart';
import 'package:kallo_mobile/shell/header/app_header_back_button.dart';
import 'package:kallo_mobile/shell/nav/pill_nav_capsule.dart';
import 'package:kallo_mobile/shell/nav/pill_nav_item.dart';
import 'package:kallo_mobile/shell/nav/pill_nav_veil.dart';

import '../../features/circle/circle_feed_test_support.dart';
import 'harness/fixture_api.dart';
import 'harness/fixtures.dart';
import 'harness/pose_harness.dart';
import 'harness/poses.dart';

/// Every window with a control column, the one turned the other way
/// included. Log stands beside the shell's capsule in each.
const _columnPoses = [
  outerPortrait,
  outerLandscape,
  Pose(
    'outer-landscape-left',
    Size(678, 466),
    EdgeInsets.only(left: 84, bottom: 34),
  ),
  innerLandscape,
  innerLandscapeLeft,
  splitLeft,
  splitRight,
  pipPinned,
];

const _noColumnPoses = [phone, innerPortrait, phoneLandscape];

Finder _item(String label) =>
    find.byWidgetPredicate((w) => w is PillNavItem && w.label == label);

String _path(WidgetTester tester) =>
    GoRouter.of(
      tester.element(find.byType(Navigator).first),
    ).state.matchedLocation;

/// Answers each `/logging/day` after [delay], counting how many are open.
class _SlowDays extends FakeApiClient {
  _SlowDays(this.delay) : super(fixtureApi(PoseFixtures()).handler) {
    final base = handler;
    handler = (request) async {
      if (request.path.startsWith('/api/v1/logging/day')) {
        dates.add(Uri.parse(request.path).queryParameters['date']!);
        open++;
        peak = math.max(peak, open);
        await Future<void>.delayed(delay);
        open--;
      }
      return base(request);
    };
  }

  final Duration delay;
  final dates = <String>[];
  int open = 0;
  int peak = 0;
}

const _out = String.fromEnvironment('DUO_OUT');

/// The days pane at every two-pane window, for the owner to look at:
/// `flutter test --update-goldens --dart-define=DUO_OUT=<dir> <this file>`.
void main() {
  setUpAll(initializePoseHarness);

  for (final pose in [innerLandscape, innerLandscapeLeft, pipPinned]) {
    for (final scale in pose == innerLandscape ? [1.0, 1.3] : [1.0]) {
      final suffix = scale == 1 ? '' : '__text-1.3';
      testWidgets('Log draws its days at ${pose.name}$suffix', (tester) async {
        final dispose = await bootPose(
          tester,
          pose,
          '/logging',
          textScale: scale,
        );
        expect(find.byType(LogDayRow), findsWidgets);
        expect(tester.takeException(), isNull);
        if (_out.isNotEmpty) {
          expect(Directory(_out).isAbsolute && autoUpdateGoldenFiles, isTrue);
          await expectLater(
            find.byType(MaterialApp),
            matchesGoldenFile(Uri.file('$_out/days__${pose.name}$suffix.png')),
          );
        }
        await dispose();
      });
    }
  }

  for (final pose in _columnPoses) {
    testWidgets('Log keeps the shell capsule at ${pose.name}', (tester) async {
      final dispose = await bootPose(tester, pose, '/logging');
      expect(find.byType(PillNavCapsule), findsOneWidget);
      expect(find.byType(AppHeaderBackButton), findsOneWidget);
      expect(tester.widget<PillNavItem>(_item('Log')).active, isTrue);
      for (final other in ['Today', 'Nutrition', 'Circle']) {
        expect(tester.widget<PillNavItem>(_item(other)).active, isFalse);
      }

      // Log again stays put.
      await tester.tap(_item('Log'));
      await settlePose(tester);
      expect(_path(tester), '/logging');
      expect(find.byType(LoggingScreen), findsOneWidget);

      // "+" opens the Add sheet over Log.
      await tester.tap(find.bySemanticsLabel('Add'));
      await tester.pumpAndSettle();
      expect(find.byType(KalloSheetSurface), findsOneWidget);
      Navigator.of(tester.element(find.byType(KalloSheetSurface))).pop();
      await tester.pumpAndSettle();

      // A branch leaves Log and opens that tab.
      await tester.tap(_item('Nutrition'));
      await settlePose(tester);
      expect(_path(tester), '/nutrition');
      expect(find.byType(LoggingScreen), findsNothing);
      expect(find.byType(NutritionScreen), findsOneWidget);
      expect(tester.widget<PillNavItem>(_item('Nutrition')).active, isTrue);
      expect(tester.widget<PillNavItem>(_item('Log')).active, isFalse);
      expect(tester.takeException(), isNull);
      await dispose();
    });
  }

  testWidgets('Today on the capsule leaves Log for the dashboard', (
    tester,
  ) async {
    final dispose = await bootPose(tester, innerLandscape, '/logging');
    await tester.tap(_item('Today'));
    await settlePose(tester);
    expect(_path(tester), '/dashboard');
    expect(find.byType(LoggingScreen), findsNothing);
    expect(find.byType(DashboardScreen), findsOneWidget);
    await tester.tap(_item('Circle'));
    await settlePose(tester);
    expect(_path(tester), '/circle');
    await dispose();
  });

  for (final pose in _noColumnPoses) {
    testWidgets('Log still covers the tab bar at ${pose.name}', (tester) async {
      final dispose = await bootPose(tester, pose, '/logging');
      // The shell is still under Log, but offstage behind the opaque page.
      expect(find.byType(PillNavCapsule), findsNothing);
      expect(find.byType(LogDaysPane), findsNothing);
      await dispose();
    });
  }

  for (final pose in [outerPortrait, innerLandscape]) {
    testWidgets('the keyboard veils the capsule on Log as on a tab at '
        '${pose.name}', (tester) async {
      Future<bool> hiddenWithKeyboard(String route) async {
        final dispose = await bootPose(tester, pose, route);
        tester.view.viewInsets = const FakeViewPadding(bottom: 600);
        await tester.pumpAndSettle();
        final hidden =
            tester.widget<PillNavVeil>(find.byType(PillNavVeil)).hidden;
        tester.view.viewInsets = const FakeViewPadding();
        await tester.pumpAndSettle();
        expect(
          tester.widget<PillNavVeil>(find.byType(PillNavVeil)).hidden,
          isFalse,
        );
        await dispose();
        return hidden;
      }

      expect(
        await hiddenWithKeyboard('/logging'),
        await hiddenWithKeyboard('/dashboard'),
      );
    });
  }

  testWidgets('one column asks for no other day than the one it shows', (
    tester,
  ) async {
    final api = _SlowDays(const Duration(milliseconds: 150));
    final dispose = await bootPose(
      tester,
      outerPortrait,
      '/logging',
      apiOverride: api,
    );
    // The day on show, and yesterday for the under-logged note, as before.
    final today = tester.widget<FeedArea>(find.byType(FeedArea)).date;
    final yesterday = DateTime.parse(
      today,
    ).subtract(const Duration(days: 1)).toIso8601String().substring(0, 10);
    expect(api.dates.toSet(), {today, yesterday});
    expect(api.dates, hasLength(2));
    expect(
      api.requests.where((r) => r.path.contains('heatmap?range=90d')),
      isEmpty,
    );
    await dispose();
  });

  testWidgets('two panes load this week two days at a time, rows steady', (
    tester,
  ) async {
    final api = _SlowDays(const Duration(milliseconds: 150));
    final dispose = await bootPose(
      tester,
      innerLandscape,
      '/logging',
      apiOverride: api,
    );
    final today = tester.widget<LogDaysPane>(find.byType(LogDaysPane)).today;
    final week = thisWeekDays(today);
    // This week, plus yesterday when today is Monday: the under-logged
    // note reads it in one column too. Each day once.
    final yesterday = DateTime.parse(
      today,
    ).subtract(const Duration(days: 1)).toIso8601String().substring(0, 10);
    final expected = {...week, yesterday};
    expect(api.dates.toSet(), expected);
    expect(api.dates, hasLength(expected.length));
    expect(api.peak, lessThanOrEqualTo(2));
    // Every row is drawn at the height it had before its day arrived.
    final heights =
        tester
            .widgetList(find.byType(LogDayRow))
            .map((row) => tester.getSize(find.byWidget(row)).height)
            .toSet();
    expect(heights, hasLength(1));
    await dispose();
  });

  testWidgets('a pull to refresh on the days refetches the loaded week, two '
      'at a time', (tester) async {
    final api = _SlowDays(const Duration(milliseconds: 150));
    final dispose = await bootPose(
      tester,
      innerLandscape,
      '/logging',
      apiOverride: api,
    );
    final today = tester.widget<LogDaysPane>(find.byType(LogDaysPane)).today;
    api.dates.clear();
    api.peak = 0;
    final scroll = tester.widget<KalloRefreshableScroll>(
      find.descendant(
        of: find.byType(LogDaysPane),
        matching: find.byType(KalloRefreshableScroll),
      ),
    );
    final done = scroll.onRefresh();
    for (var i = 0; i < 20; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    await done;
    // Each day of this week once: a meal logged elsewhere reaches its row.
    expect(api.dates.toSet(), thisWeekDays(today).toSet());
    expect(api.dates, hasLength(thisWeekDays(today).length));
    expect(api.peak, lessThanOrEqualTo(2));
    expect(tester.takeException(), isNull);
    await dispose();
  });

  testWidgets('Log with no tab under it covers the column instead of leaving '
      'it open', (tester) async {
    final dispose = await bootPose(tester, outerPortrait, '/dashboard');
    // Not how the app opens Log (see `openLogging`), but a bare `go` must
    // not leave an open column with nothing behind it.
    GoRouter.of(tester.element(find.byType(DashboardScreen))).go('/logging');
    await settlePose(tester);
    expect(find.byType(LoggingScreen), findsOneWidget);
    expect(find.byType(PillNavCapsule), findsNothing);
    final route = ModalRoute.of(tester.element(find.byType(LoggingScreen)))!;
    expect(route.opaque, isTrue);
    expect(tester.takeException(), isNull);
    await dispose();
  });

  for (final from in [innerPortrait, phone]) {
    testWidgets('a window that gains its column with Log open shows the '
        'capsule in it (from ${from.name})', (tester) async {
      final dispose = await bootPose(tester, from, '/logging');
      for (final to in [innerLandscape, innerLandscapeLeft, outerPortrait]) {
        resize(tester, to);
        await settlePose(tester);
        // The shell slid aside under the opaque page; beside a column it
        // has to be back, or the column is empty and the capsule off screen.
        final capsule = tester.getRect(find.byType(PillNavCapsule));
        final left = to.padding.left > 0 ? 0.0 : to.size.width - 84;
        expect(capsule.left, greaterThanOrEqualTo(left), reason: to.name);
        expect(capsule.right, lessThanOrEqualTo(left + 84), reason: to.name);
        expect(find.byType(LoggingScreen), findsOneWidget);
      }
      expect(tester.takeException(), isNull);
      await dispose();
    });
  }

  testWidgets('rows and rings select their day; the future does not', (
    tester,
  ) async {
    final dispose = await bootPose(tester, innerLandscape, '/logging');
    final pane = tester.widget<LogDaysPane>(find.byType(LogDaysPane));
    final week = weekDates(weekOf(pane.today));
    String shown() => tester.widget<FeedArea>(find.byType(FeedArea)).date;
    // Seven rows, Monday first, under seven rings.
    final rows = tester.widgetList<LogDayRow>(find.byType(LogDayRow)).toList();
    expect([for (final row in rows) row.date], week);
    expect(find.byType(LogCalendarDay), findsNWidgets(7));
    // A row of a day that has come selects it.
    final monday = find.byWidgetPredicate(
      (w) => w is LogDayRow && w.date == week.first,
    );
    await tester.tap(monday);
    await settlePose(tester);
    expect(shown(), week.first);
    // Neither the ring nor the row of a day still to come does.
    for (final future in [
      find.byWidgetPredicate((w) => w is LogCalendarDay && w.isFuture),
      find.byWidgetPredicate((w) => w is LogDayRow && w.isFuture),
    ]) {
      if (future.evaluate().isEmpty) continue;
      await tester.tap(future.first, warnIfMissed: false);
      await settlePose(tester);
      expect(shown(), week.first);
    }
    // A ring selects its day.
    await tester.tap(
      find.byWidgetPredicate((w) => w is LogCalendarDay && w.isToday),
    );
    await settlePose(tester);
    expect(shown(), pane.today);
    await dispose();
  });

  testWidgets('the chevrons page a week at a time', (tester) async {
    final dispose = await bootPose(tester, innerLandscape, '/logging');
    final pane = tester.widget<LogDaysPane>(find.byType(LogDaysPane));
    final week = weekOf(pane.today);
    List<String> rows() => [
      for (final row in tester.widgetList<LogDayRow>(find.byType(LogDayRow)))
        row.date,
    ];
    await tester.tap(find.bySemanticsLabel('logging.days.previousWeek'.tr()));
    await settlePose(tester);
    expect(rows(), weekDates(shiftWeek(week, -1)));
    // The day on show beside the pane stays the one that was chosen.
    expect(tester.widget<FeedArea>(find.byType(FeedArea)).date, pane.today);
    await tester.tap(find.bySemanticsLabel('logging.days.nextWeek'.tr()));
    await settlePose(tester);
    expect(rows(), weekDates(week));
    await dispose();
  });

  testWidgets('the selected row counts what the gauges count after a save', (
    tester,
  ) async {
    final dispose = await bootPose(tester, innerLandscape, '/logging');
    final area = tester.widget<FeedArea>(find.byType(FeedArea));
    final scope = ProviderScope.containerOf(
      tester.element(find.byType(FeedArea)),
    );
    final args = LoggingDayArgs(area.profile.userId, area.date);
    final first =
        scope.read(loggingDayProvider(args)).value!.persistedMeals.first;
    // The first meal grows from 460 to 800 kcal: the day from 2,030 to 2,370.
    scope
        .read(loggingDayProvider(args).notifier)
        .reconcileMeal(
          PersistedMeal(
            id: first.id,
            rawInput: first.rawInput,
            loggedAt: first.loggedAt,
            nutrition: const MealNutrition(
              caloriesKcal: 800,
              proteinG: 22,
              carbohydrateG: 48,
              fatG: 20,
            ),
            mealItemGroups: first.mealItemGroups,
          ),
        );
    await tester.pump();
    expect(
      find.descendant(
        of: find.byWidgetPredicate(
          (w) => w is LogDayRow && w.date == area.date,
        ),
        matching: find.text('2,370 kcal'),
      ),
      findsOneWidget,
    );
    expect(find.textContaining('2,370/'), findsOneWidget);
    await dispose();
  });
}
