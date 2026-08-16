import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/logging/data/stream_analysis_controller.dart';
import 'package:kallo_mobile/features/logging/widgets/streaming/stream_ticker_line.dart';
import 'package:kallo_mobile/features/logging/widgets/streaming/streaming_entry.dart';
import 'package:kallo_mobile/models/meal.dart';
import 'package:kallo_mobile/models/streaming.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';

import '../../l10n_test_loader.dart';

MealItem _item(String id, String name, double calories) => MealItem(
  id: id,
  name: name,
  quantity: 1,
  unit: 'serving',
  macros: MacroBreakdown(calories: calories, protein: 20, carbs: 30, fat: 10),
);

/// Reduced motion on purpose: the loaders run on a repeating [Ticker], so a
/// live one makes `pumpAndSettle` time out. Any test that mounts this widget
/// must either disable animations or drive it with explicit pumps.
Widget _wrap(StreamAnalysisState stream) => EasyLocalization(
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
        data: const MediaQueryData(disableAnimations: true),
        child: Scaffold(
          backgroundColor: KalloColors.surface,
          body: SingleChildScrollView(
            child: StreamingEntry(stream: stream, loaderIndex: 0),
          ),
        ),
      ),
    ),
  ),
);

Future<void> _pump(WidgetTester tester, StreamAnalysisState stream) async {
  await tester.pumpWidget(_wrap(stream));
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

  testWidgets('shows the stage action verb before any dish is known', (
    tester,
  ) async {
    await _pump(
      tester,
      const StreamAnalysisState(
        status: StreamStatus.matching,
        isAnalyzing: true,
      ),
    );
    expect(find.text('Foraging…'), findsOneWidget);
  });

  testWidgets('streams data out: resolved rows, then detected names', (
    tester,
  ) async {
    await _pump(
      tester,
      StreamAnalysisState(
        status: StreamStatus.estimating,
        isAnalyzing: true,
        items: const ['Phở bò', 'Rau thơm'],
        completedItems: [_item('a', 'Phở bò', 480)],
      ),
    );

    // The resolved dish carries real macros...
    expect(find.text('Phở bò'), findsWidgets);
    expect(find.text('P:'), findsOneWidget);
    // ...and the one still being priced shows as a bare name.
    expect(find.text('Rau thơm'), findsOneWidget);
  });

  testWidgets('a name is not repeated once its macros land', (tester) async {
    await _pump(
      tester,
      StreamAnalysisState(
        status: StreamStatus.estimating,
        isAnalyzing: true,
        // Casing differs between the two pipeline calls on purpose.
        items: const ['phở bò'],
        completedItems: [_item('a', 'Phở bò', 480)],
      ),
    );
    // The resolved row only — matched case-insensitively, not a second bare
    // name row underneath it.
    expect(find.text('Phở bò'), findsOneWidget);
    expect(find.text('phở bò'), findsNothing);
  });

  testWidgets('the ticker carries the newest resolved dish and its kcal', (
    tester,
  ) async {
    await _pump(
      tester,
      StreamAnalysisState(
        status: StreamStatus.estimating,
        isAnalyzing: true,
        completedItems: [_item('a', 'Phở bò', 480), _item('b', 'Chè', 210.4)],
      ),
    );
    expect(find.textContaining('· 210 kcal'), findsOneWidget);
  });

  testWidgets('pins the loading line ABOVE the rows so it cannot drift', (
    tester,
  ) async {
    await _pump(
      tester,
      StreamAnalysisState(
        status: StreamStatus.estimating,
        isAnalyzing: true,
        items: const ['Rau thơm'],
        completedItems: [_item('a', 'Phở bò', 480)],
      ),
    );

    // Below the rows it slid down by a row's height every time a dish landed —
    // the one element meant to say "still working" was the one that moved.
    final ticker = tester.getRect(find.byType(StreamTickerLine));
    expect(ticker.bottom, lessThanOrEqualTo(tester.getRect(find.text('Phở bò')).top));
    expect(ticker.bottom, lessThanOrEqualTo(tester.getRect(find.text('Rau thơm')).top));
  });

  testWidgets('renders BARE — no card chrome around the streamed rows', (
    tester,
  ) async {
    await _pump(
      tester,
      StreamAnalysisState(
        status: StreamStatus.estimating,
        isAnalyzing: true,
        completedItems: [_item('a', 'Phở bò', 480)],
      ),
    );

    // The card is the finished thing. Nothing inside the streaming body may
    // paint the card's white fill, border or shadow.
    final decorations = tester
        .widgetList<DecoratedBox>(
          find.descendant(
            of: find.byType(StreamingEntry),
            matching: find.byType(DecoratedBox),
          ),
        )
        .map((d) => d.decoration)
        .whereType<BoxDecoration>();

    for (final decoration in decorations) {
      expect(decoration.color, isNot(KalloColors.elev));
      expect(decoration.border, isNull);
      expect(decoration.boxShadow, anyOf(isNull, isEmpty));
    }
  });

  testWidgets('keeps the card\'s 16px content inset so nothing shifts at reveal', (
    tester,
  ) async {
    await _pump(
      tester,
      StreamAnalysisState(
        status: StreamStatus.estimating,
        isAnalyzing: true,
        completedItems: [_item('a', 'Phở bò', 480)],
      ),
    );
    final body = tester.getRect(find.byType(StreamingEntry));
    final row = tester.getRect(find.text('Phở bò'));
    expect(row.left - body.left, closeTo(16, 0.5));
  });
}
