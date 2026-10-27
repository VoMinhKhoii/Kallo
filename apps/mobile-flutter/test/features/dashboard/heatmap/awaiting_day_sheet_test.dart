import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/dashboard/data/dashboard_providers.dart';
import 'package:kallo_mobile/features/dashboard/data/logging_day.dart';
import 'package:kallo_mobile/features/dashboard/widgets/heatmap/adherence_heatmap.dart';
import 'package:kallo_mobile/features/dashboard/widgets/heatmap/heatmap_grid_painter.dart';
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

PersistedMeal _meal(String id, String name, String at, double kcal) =>
    PersistedMeal(
      id: id,
      rawInput: name,
      loggedAt: at,
      nutrition: MealNutrition(caloriesKcal: kcal),
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

Widget _app({ApiClient? api, void Function()? onHeatmapBuild}) => ProviderScope(
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
        persistedMeals: [
          _meal('m2', 'Cơm tấm', '2026-10-20T12:00:00Z', 600),
          _meal('m1', 'Phở bò', '2026-10-20T01:00:00Z', 300),
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
          (context) => MaterialApp(
            localizationsDelegates: context.localizationDelegates,
            supportedLocales: context.supportedLocales,
            locale: context.locale,
            home: const Scaffold(body: AdherenceHeatmap(args: _args)),
          ),
    ),
  ),
);

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

    expect(
      find.text('Mon, Oct 12 · 2,000 kcal\nOn target · 100%'),
      findsOneWidget,
    );
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
    expect(find.text("That's everything I ate"), findsOneWidget);
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

    await tester.tap(find.text("That's everything I ate"));
    await tester.pump();
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
}
