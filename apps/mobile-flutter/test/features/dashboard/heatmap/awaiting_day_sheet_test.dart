import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:kallo_mobile/features/dashboard/data/dashboard_providers.dart';
import 'package:kallo_mobile/features/dashboard/data/logging_day.dart';
import 'package:kallo_mobile/features/dashboard/widgets/heatmap/adherence_heatmap.dart';
import 'package:kallo_mobile/features/dashboard/widgets/heatmap/heatmap_grid_painter.dart';
import 'package:kallo_mobile/features/logging/data/handoff_slots.dart';
import 'package:kallo_mobile/models/profile/heatmap.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

import '../../../l10n_test_loader.dart';

/// Tapping a heatmap day: a logged day answers with its date and kcal in the
/// bubble; an awaiting day opens the sheet that recalls its meals.
const _today = '2026-10-27';
const _args = (userId: 'u1', date: _today);
const _weeks = 2;

HeatmapCell _cell(int day, int week) {
  final date = DateTime(2026, 10, 12 + week * 7 + day);
  final key = DateFormat('yyyy-MM-dd').format(date);
  return switch ((day, week)) {
    (0, 0) => HeatmapCell(
      date: key,
      ratio: 1.0,
      consumedRatio: 1.0,
      calories: 2000,
      status: HeatmapCellStatus.logged,
    ),
    (1, 1) => HeatmapCell(
      date: key,
      ratio: null,
      consumedRatio: 0.45,
      calories: 900,
      status: HeatmapCellStatus.partial,
    ),
    _ => HeatmapCell(
      date: key,
      ratio: null,
      consumedRatio: null,
      status: HeatmapCellStatus.unlogged,
    ),
  };
}

PersistedMeal _meal(
  String id,
  String name,
  String at,
  double kcal, {
  required double protein,
  required double fat,
}) => PersistedMeal(
  id: id,
  rawInput: name,
  loggedAt: at,
  // Carbs never measured: the total says so rather than a confident zero.
  nutrition: MealNutrition(caloriesKcal: kcal, proteinG: protein, fatG: fat),
);

/// Holds every POST open until the test completes [reply].
class _SlowApi extends ApiClient {
  final reply = Completer<Map<String, dynamic>>();
  final posts = <String>[];

  @override
  Future<T> post<T>(String path, [Object? body]) async {
    posts.add(path);
    return await reply.future as T;
  }
}

Widget _app({
  ApiClient? api,
  void Function()? onHeatmapBuild,
  List<PersistedMeal>? meals,
  bool withRouter = false,
}) => ProviderScope(
  overrides: [
    if (api != null) apiClientProvider.overrideWithValue(api),
    heatmapProvider.overrideWith((ref, args) async {
      onHeatmapBuild?.call();
      return HeatmapData(
        cells: [
          for (var d = 0; d < 7; d++)
            [for (var w = 0; w < _weeks; w++) _cell(d, w)],
        ],
        monthHeaders: const [],
      );
    }),
    dashboardBundleProvider.overrideWith(
      (ref, args) => Future.error(StateError('no bundle in this test')),
    ),
    // The server answers newest first.
    dashboardDayProvider.overrideWith(
      (ref, args) async => LoggingDayData(
        persistedMeals:
            meals ??
            [
              _meal(
                'm2',
                'Cơm tấm',
                '2026-10-20T12:00:00Z',
                600,
                protein: 20.4,
                fat: 10,
              ),
              _meal(
                'm1',
                'Phở bò',
                '2026-10-20T01:00:00Z',
                300,
                protein: 15.3,
                fat: 4.4,
              ),
            ],
      ),
    ),
  ],
  child: EasyLocalization(
    supportedLocales: const [Locale('en')],
    path: 'assets/l10n',
    fallbackLocale: const Locale('en'),
    assetLoader: const FsL10nLoader(),
    child: Builder(
      builder:
          (context) =>
              withRouter
                  ? MaterialApp.router(
                    localizationsDelegates: context.localizationDelegates,
                    supportedLocales: context.supportedLocales,
                    locale: context.locale,
                    routerConfig: GoRouter(
                      initialLocation: '/dashboard',
                      routes: [
                        GoRoute(
                          path: '/dashboard',
                          builder:
                              (_, __) => const Scaffold(
                                body: AdherenceHeatmap(args: _args),
                              ),
                        ),
                        GoRoute(
                          path: '/logging',
                          builder: (_, __) => const Text('LOGGING'),
                        ),
                      ],
                    ),
                  )
                  : MaterialApp(
                    localizationsDelegates: context.localizationDelegates,
                    supportedLocales: context.supportedLocales,
                    locale: context.locale,
                    home: const Scaffold(body: AdherenceHeatmap(args: _args)),
                  ),
    ),
  ),
);

/// Taps the sheet's confirm, then answers the "are you sure?" yes.
Future<void> _confirmDay(WidgetTester tester) async {
  await tester.tap(find.text("That's everything I ate"));
  await tester.pumpAndSettle();
  expect(find.text('Mark this day as fully logged?'), findsOneWidget);
  await tester.tap(find.text("That's everything I ate").last);
  await tester.pump();
}

Future<void> _tapCell(WidgetTester tester, int day, int week) async {
  final finder = find.byWidgetPredicate(
    (w) => w is CustomPaint && w.painter is HeatmapGridPainter,
  );
  final painter =
      tester.widget<CustomPaint>(finder).painter as HeatmapGridPainter;
  final origin = tester.getTopLeft(finder);
  await tester.tapAt(
    origin +
        Offset(
          week * painter.step + painter.sq / 2,
          day * painter.step + painter.sq / 2,
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

  testWidgets('a logged day shows its date and kcal in the bubble', (
    tester,
  ) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    await _tapCell(tester, 0, 0);

    expect(find.text('Mon, Oct 12 · 2,000 kcal'), findsOneWidget);
  });

  testWidgets('an awaiting day opens a sheet recalling its meals', (
    tester,
  ) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    await _tapCell(tester, 1, 1);

    expect(find.text('Tuesday, October 20'), findsOneWidget);
    final first = tester.getTopLeft(find.text('Phở bò')).dy;
    final second = tester.getTopLeft(find.text('Cơm tấm')).dy;
    expect(first, lessThan(second), reason: 'oldest meal first');
    // Each meal sits under a rule carrying its time.
    expect(
      find.text(
        DateFormat.jm(
          'en',
        ).format(DateTime.parse('2026-10-20T01:00:00Z').toLocal()),
      ),
      findsOneWidget,
    );
    // The total is one line: label, macros, then kcal. No meal measured carbs,
    // so the total has none rather than a confident zero.
    expect(find.text('Total'), findsOneWidget);
    expect(find.text('P 36g'), findsOneWidget);
    expect(find.text('F 14g'), findsOneWidget);
    expect(find.text('900 kcal'), findsOneWidget);
    expect(find.textContaining('C '), findsNothing);
    expect(find.text("That's everything I ate"), findsOneWidget);
  });

  testWidgets('on a long day the total and the confirm stay on screen', (
    tester,
  ) async {
    await tester.pumpWidget(
      _app(
        meals: [
          for (var i = 0; i < 12; i++)
            _meal(
              'm$i',
              'Meal $i',
              // Newest first, as the server sends them.
              '2026-10-20T${(23 - i).toString().padLeft(2, '0')}:00:00Z',
              100,
              protein: 5,
              fat: 2,
            ),
        ],
      ),
    );
    await tester.pumpAndSettle();
    await _tapCell(tester, 1, 1);

    final screen = tester.view.physicalSize / tester.view.devicePixelRatio;
    expect(
      tester.getBottomLeft(find.text('Total')).dy,
      lessThan(screen.height),
    );
    expect(
      tester.getBottomLeft(find.text("That's everything I ate")).dy,
      lessThan(screen.height),
    );
    expect(find.text('1,200 kcal'), findsOneWidget);
    // The meals scroll under them: the oldest (Meal 11) leads, and the newest
    // is past the fold.
    expect(find.text('Meal 11'), findsOneWidget);
    expect(
      tester.getTopLeft(find.text('Meal 0')).dy,
      greaterThan(tester.getTopLeft(find.text('Total')).dy),
    );
  });

  testWidgets('cancelling the ask marks nothing', (tester) async {
    final api = _SlowApi();
    await tester.pumpWidget(_app(api: api));
    await tester.pumpAndSettle();
    await _tapCell(tester, 1, 1);

    await tester.tap(find.text("That's everything I ate"));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Not now'));
    await tester.pumpAndSettle();

    expect(api.posts, isEmpty);
    expect(find.text('Tuesday, October 20'), findsOneWidget);
  });

  testWidgets('"Add a missed meal" opens logging on that day', (tester) async {
    await tester.pumpWidget(_app(withRouter: true));
    await tester.pumpAndSettle();
    await _tapCell(tester, 1, 1);

    await tester.tap(find.text('Add a missed meal'));
    await tester.pumpAndSettle();

    expect(find.text('LOGGING'), findsOneWidget);
    final scope = ProviderScope.containerOf(
      tester.element(find.text('LOGGING')),
    );
    expect(scope.read(pendingLoggingDayProvider), '2026-10-20');
  });

  testWidgets('a mark that lands after the sheet is swiped away still '
      'refreshes the heatmap', (tester) async {
    final api = _SlowApi();
    var heatmapBuilds = 0;
    await tester.pumpWidget(
      _app(api: api, onHeatmapBuild: () => heatmapBuilds++),
    );
    await tester.pumpAndSettle();
    await _tapCell(tester, 1, 1);

    await _confirmDay(tester);
    expect(api.posts, ['/api/v1/logging/day/complete']);

    // Dismiss through the backdrop while the request is still in flight.
    await tester.tapAt(const Offset(10, 10));
    await tester.pumpAndSettle();
    expect(find.text('Tuesday, October 20'), findsNothing);
    final buildsBefore = heatmapBuilds;

    api.reply.complete(<String, dynamic>{'success': true});
    await tester.pumpAndSettle();

    expect(heatmapBuilds, greaterThan(buildsBefore));
    expect(
      find.text("Couldn't confirm this day. Please try again."),
      findsNothing,
    );
  });

  testWidgets('a mark that lands mid-dismissal pops only the sheet', (
    tester,
  ) async {
    final api = _SlowApi();
    await tester.pumpWidget(_app(api: api));
    await tester.pumpAndSettle();
    await _tapCell(tester, 1, 1);

    await _confirmDay(tester);

    // The request lands while the swipe-away is still animating: the sheet's
    // state is mounted but its route is no longer current.
    await tester.tapAt(const Offset(10, 10));
    await tester.pump(const Duration(milliseconds: 50));
    api.reply.complete(<String, dynamic>{'success': true});
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.byType(AdherenceHeatmap), findsOneWidget);
    expect(find.text('Tuesday, October 20'), findsNothing);
  });
}
