import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/dashboard/data/dashboard_providers.dart';
import 'package:kallo_mobile/features/dashboard/widgets/chrome/week_strip.dart';
import 'package:kallo_mobile/models/profile/dashboard.dart';

import '../../../l10n_test_loader.dart';

/// The home date chip strip could not be swiped: it was a plain Row of the 7
/// days around today, so a day older than three days ago was unreachable. It
/// is now a week pager — unbounded into the past, clamped at today.
const _userId = '11111111-1111-1111-1111-111111111111';
const _today = '2026-09-03'; // a Thursday

/// Today's week (centred on today): Aug 31 → Sep 6.
/// One page back: Aug 24 → Aug 30.
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

  const args = (userId: _userId, date: _today);

  Future<void> pump(
    WidgetTester tester, {
    required List<String> taps,
    String selected = _today,
  }) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          // Never resolves: the strip must render (and page) off the heatmap's
          // absence — which is also what a day older than the 90-day window
          // looks like, an uncoloured but browsable cell.
          heatmapProvider.overrideWith(
            (ref, a) => Completer<HeatmapData>().future,
          ),
        ],
        child: EasyLocalization(
          supportedLocales: const [Locale('en')],
          path: 'assets/l10n',
          fallbackLocale: const Locale('en'),
          assetLoader: const FsL10nLoader(),
          child: Builder(
            builder: (context) => MaterialApp(
              localizationsDelegates: context.localizationDelegates,
              supportedLocales: context.supportedLocales,
              locale: context.locale,
              home: Scaffold(
                body: WeekStrip(
                  args: args,
                  todayDate: _today,
                  selectedDate: selected,
                  onSelectDay: taps.add,
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('opens on today\'s week', (tester) async {
    await pump(tester, taps: []);
    expect(find.text('3'), findsOneWidget, reason: 'today is on screen');
    expect(find.text('31'), findsOneWidget, reason: 'Aug 31 opens the week');
    expect(find.text('24'), findsNothing, reason: 'last week is off-page');
  });

  testWidgets('swiping right pages to the previous week', (tester) async {
    await pump(tester, taps: []);

    // Left-to-right by one page width = one week back.
    await tester.drag(find.byType(WeekStrip), const Offset(390, 0));
    await tester.pumpAndSettle();

    expect(find.text('27'), findsOneWidget, reason: 'Aug 27 is now on screen');
    expect(find.text('24'), findsOneWidget);
    expect(find.text('30'), findsOneWidget);
    expect(find.text('3'), findsNothing, reason: 'today\'s page is gone');
  });

  testWidgets('tapping a day on the previous week reports its date', (
    tester,
  ) async {
    final taps = <String>[];
    await pump(tester, taps: taps);

    await tester.drag(find.byType(WeekStrip), const Offset(390, 0));
    await tester.pumpAndSettle();

    await tester.tap(find.text('27'));
    await tester.pump();

    expect(taps, ['2026-08-27']);
  });

  testWidgets('a day after today is not selectable', (tester) async {
    final taps = <String>[];
    await pump(tester, taps: taps);

    // Sep 4 is on today's page but in the future: no tap handler at all.
    expect(
      find.ancestor(
        of: find.text('4'),
        matching: find.byType(GestureDetector),
      ),
      findsNothing,
      reason: 'a future day must not be wrapped in a tap target',
    );
    // …and today, the control, is.
    expect(
      find.ancestor(
        of: find.text('2'),
        matching: find.byType(GestureDetector),
      ),
      findsOneWidget,
    );

    await tester.tap(find.text('4'), warnIfMissed: false);
    await tester.pump();
    expect(taps, isEmpty);
  });
}
