import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/data/logging_providers.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/manual/add/manual_add_sheet.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/manual/manual_log_sheet.dart';

import '../../../app_fonts.dart';
import 'manual_harness.dart';

/// The edges of the flow: saving (a name or none, a failure and its retry, a
/// second tap, a swipe mid-save), the amount's bounds and the ruler's ends, a
/// food with no calories, every search state, the 30-item cap, the keyboard,
/// Vietnamese, and a name too long for one line.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/shared_preferences'),
          (call) async => call.method == 'getAll' ? <String, Object>{} : null,
        );
    await EasyLocalization.ensureInitialized();
    await loadAppFonts();
  });

  Finder inAdd(Finder finder) =>
      find.descendant(of: find.byType(ManualAddSheet), matching: finder);
  Finder inMeal(Finder finder) =>
      find.descendant(of: find.byType(ManualLogSheet), matching: finder);
  Finder amountField() => find.byType(CupertinoTextField);

  Future<void> tap(WidgetTester tester, Finder finder) async {
    await tester.tap(finder);
    await tester.pumpAndSettle();
  }

  Future<void> typeAmount(WidgetTester tester, String text) async {
    await tester.enterText(amountField(), text);
    await tester.pumpAndSettle();
  }

  String amountText(WidgetTester tester) =>
      tester.widget<CupertinoTextField>(amountField()).controller!.text;

  Map<String, dynamic> lastBody(FakeManualApi api) =>
      api.posts.last.$2! as Map<String, dynamic>;

  group('saving', () {
    for (final (typed, sent) in [
      ('', null),
      ('   ', null),
      ('  Cơm gà trưa  ', 'Cơm gà trưa'),
    ]) {
      testWidgets('name "$typed" is sent as ${sent ?? 'nothing'}', (
        tester,
      ) async {
        sizeTo(tester, const Size(390, 844));
        final api = FakeManualApi();
        await openManualSheet(tester, api, seed: seededItems(2));
        expect(find.text('Food 1 + Food 2'), findsOneWidget);
        await tester.enterText(find.byType(TextField).first, typed);
        await tap(tester, find.text('Save'));
        expect(lastBody(api)['name'], sent);
        expect(lastBody(api).containsKey('name'), sent != null);
        expect(lastBody(api)['loggedDate'], '2026-06-12');
        expect(find.byType(ManualLogSheet), findsNothing);
      });
    }

    testWidgets('a failed save keeps the plate and says so; again succeeds', (
      tester,
    ) async {
      sizeTo(tester, const Size(390, 844));
      final api = FakeManualApi(failSaves: 1);
      await openManualSheet(tester, api, seed: seededItems(2));
      await tester.enterText(find.byType(TextField).first, 'Lunch');
      await tap(tester, find.text('Save'));

      expect(find.text('Something went wrong. Please try again.'), findsOne);
      expect(find.byType(ManualLogSheet), findsOneWidget);
      expect(find.text('2 ingredients'), findsOneWidget);
      expect(find.widgetWithText(TextField, 'Lunch'), findsOneWidget);

      await tap(tester, find.text('Save'));
      expect(api.posts, hasLength(2));
      expect(lastBody(api)['name'], 'Lunch');
      expect(find.byType(ManualLogSheet), findsNothing);
    });

    testWidgets('in flight: one request, and the sheet holds still', (
      tester,
    ) async {
      sizeTo(tester, const Size(390, 844));
      final gate = Completer<void>();
      final api = FakeManualApi(saveGate: gate);
      await openManualSheet(tester, api, seed: seededItems(1));
      await tester.tap(find.text('Save'));
      // Past the Save tap's own gesture window, so the barrier tap below is a
      // fresh one (an early tap is swallowed and proves nothing).
      await tester.pump(const Duration(seconds: 1));

      // A second tap, the X, the barrier, a row and the add row all do
      // nothing while the request is out.
      await tester.tap(find.byType(ManualLogSheet), warnIfMissed: false);
      await tester.tap(inMeal(find.bySemanticsLabel('Close')));
      await tester.tapAt(const Offset(195, 20));
      await tester.tap(find.text('Add ingredient'));
      await tester.tap(inMeal(find.text('100 g')), warnIfMissed: false);
      for (var i = 0; i < 10; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      expect(api.posts, hasLength(1));
      expect(find.byType(ManualLogSheet), findsOneWidget);
      expect(find.byType(ManualAddSheet), findsNothing);

      gate.complete();
      await tester.pumpAndSettle();
      expect(api.posts, hasLength(1));
      expect(find.byType(ManualLogSheet), findsNothing);
    });

    testWidgets('swiped away mid-save, the save lands and the feed refreshes', (
      tester,
    ) async {
      sizeTo(tester, const Size(390, 844));
      final gate = Completer<void>();
      final api = FakeManualApi(saveGate: gate);
      await openManualSheet(tester, api, seed: seededItems(1));
      // Stand in for the feed: something watching the meal dates.
      final container = ProviderScope.containerOf(
        tester.element(find.text('open')),
      );
      final sub = container.listen(mealDatesProvider('u1'), (_, _) {});
      addTearDown(sub.close);
      await tester.pumpAndSettle();
      int datesFetches() =>
          api.gets.where((p) => p.startsWith('/api/v1/meals/dates')).length;
      expect(datesFetches(), 1);

      await tester.tap(find.text('Save'));
      await tester.pump(const Duration(milliseconds: 100));
      await tester.fling(
        inMeal(find.text('Manual log')),
        const Offset(0, 600),
        2000,
      );
      await tester.pump(const Duration(milliseconds: 600));
      // A drag pops past PopScope: the sheet is gone, the request is not.
      expect(find.byType(ManualLogSheet), findsNothing);

      gate.complete();
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(api.posts, hasLength(1));
      expect(datesFetches(), 2);
    });
  });

  group('amount', () {
    Future<void> openYogurt(WidgetTester tester) async {
      sizeTo(tester, const Size(390, 844));
      await openManualSheet(tester, FakeManualApi());
      await tap(tester, find.text('Add ingredient'));
      await tap(tester, inAdd(find.text('Sữa chua (từ sữa bò)')));
    }

    testWidgets('a food with no vessel opens at 100 g, no tape, no state', (
      tester,
    ) async {
      await openYogurt(tester);
      expect(amountText(tester), '100');
      expect(find.text('Weighed'), findsNothing);
      expect(find.bySemanticsLabel('Amount in grams'), findsNothing);
      expect(find.text('custom'), findsNothing);
    });

    testWidgets('typed and stepped amounts stay inside the range', (
      tester,
    ) async {
      await openYogurt(tester);

      await typeAmount(tester, '10');
      await tap(tester, find.bySemanticsLabel('Less'));
      expect(amountText(tester), '10');
      await tap(tester, find.bySemanticsLabel('More'));
      expect(amountText(tester), '20');

      await typeAmount(tester, '7');
      await tap(tester, find.bySemanticsLabel('Less'));
      expect(amountText(tester), '7');
      await tap(tester, find.bySemanticsLabel('More'));
      expect(amountText(tester), '10');

      await typeAmount(tester, '5000');
      await tap(tester, find.bySemanticsLabel('More'));
      expect(amountText(tester), '5000');
      await tap(tester, find.bySemanticsLabel('Less'));
      expect(amountText(tester), '4990');

      await typeAmount(tester, '99999');
      expect(amountText(tester), '5000');
      expect(find.text('3050'), findsOneWidget); // 5000 g × 61 kcal/100 g

      // Cleared or zero: the last real amount stands, and returns on blur.
      await typeAmount(tester, '250');
      await typeAmount(tester, '');
      expect(find.text('153'), findsOneWidget);
      await typeAmount(tester, '0');
      expect(find.text('153'), findsOneWidget);
      await tap(tester, find.text('Add ingredients'));
      expect(amountText(tester), '250');

      await tap(tester, find.text('Add to meal'));
      expect(find.text('250 g in meal'), findsOneWidget);
    });

    testWidgets('the tape: a tap jumps to a vessel, a drag stops at its ends', (
      tester,
    ) async {
      sizeTo(tester, const Size(390, 844));
      await openManualSheet(tester, FakeManualApi());
      await tap(tester, find.text('Add ingredient'));
      await tap(tester, inAdd(find.text('Ức gà')));
      expect(amountText(tester), '150');
      expect(find.text('medium cut'), findsOneWidget);

      await tap(tester, find.bySemanticsLabel(RegExp('^slice')));
      expect(amountText(tester), '70');
      expect(find.text('slice'), findsOneWidget);

      final tape = find.bySemanticsLabel('Amount in grams');
      await tester.drag(tape, const Offset(-4000, 0));
      await tester.pumpAndSettle();
      expect(amountText(tester), '750');
      expect(find.bySemanticsLabel('More'), findsOneWidget);
      await tester.drag(tape, const Offset(4000, 0));
      await tester.pumpAndSettle();
      expect(amountText(tester), '10');
      expect(find.text('custom'), findsOneWidget);
    });
  });

  testWidgets('unknown calories read "—", never 0, all the way to the plate', (
    tester,
  ) async {
    sizeTo(tester, const Size(390, 844));
    final api = FakeManualApi();
    await openManualSheet(tester, api);
    await tap(tester, find.text('Add ingredient'));
    await search(tester, 'lá mơ');
    expect(inAdd(find.text('— kcal', findRichText: true)), findsOneWidget);

    await tap(tester, inAdd(find.text('Lá mơ lông')));
    expect(find.text('— kcal / 100 g'), findsOneWidget);
    expect(find.textContaining('with this'), findsNothing);
    await tap(tester, find.text('Add to meal'));
    await tap(tester, find.text('Done'));

    expect(find.bySemanticsLabel('— kcal'), findsOneWidget);
    expect(find.text('— kcal'), findsOneWidget); // the row
    expect(find.text('4.1 g'), findsOneWidget); // protein is known
    await tap(tester, find.text('Save'));
    expect(lastBody(api)['items'], [
      {'foodCompositionId': 'fct-mystery', 'grams': 100.0},
    ]);
  });

  group('search', () {
    testWidgets('no recents yet: a hint, not an empty card', (tester) async {
      sizeTo(tester, const Size(390, 844));
      await openManualSheet(tester, FakeManualApi(recents: const []));
      await tap(tester, find.text('Add ingredient'));
      expect(find.text('Search to add foods'), findsOneWidget);
    });

    testWidgets('no match, a failure, and clear back to recents', (
      tester,
    ) async {
      sizeTo(tester, const Size(390, 844));
      await openManualSheet(tester, FakeManualApi());
      await tap(tester, find.text('Add ingredient'));

      await search(tester, 'xyz');
      expect(find.text('No foods found'), findsOneWidget);
      await search(tester, 'boom');
      expect(find.text('Something went wrong. Please try again.'), findsOne);

      await tap(tester, find.byTooltip('Clear search'));
      await tester.pump(const Duration(milliseconds: 350));
      await tester.pumpAndSettle();
      expect(find.text('Recent'), findsOneWidget);
      expect(find.text('Cơm trắng'), findsOneWidget);
      expect(find.byTooltip('Clear search'), findsNothing);
    });

    testWidgets('typing keeps the last results until the next arrive', (
      tester,
    ) async {
      sizeTo(tester, const Size(390, 844));
      final api = FakeManualApi(searchDelay: const Duration(seconds: 1));
      await openManualSheet(tester, api);
      await tap(tester, find.text('Add ingredient'));
      await tester.enterText(find.byType(TextField).last, 'ức gà');
      await tester.pump(const Duration(milliseconds: 350));
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Ức gà hầm, bỏ da'), findsOneWidget);

      // Quick typing debounces into one request…
      await tester.enterText(find.byType(TextField).last, 'xy');
      await tester.pump(const Duration(milliseconds: 100));
      await tester.enterText(find.byType(TextField).last, 'xyz');
      await tester.pump(const Duration(milliseconds: 350));
      expect(api.queries.where((q) => q.startsWith('xy')), ['xyz']);
      // …and while it loads, the last results stay, under their own query.
      expect(find.text('Ức gà hầm, bỏ da'), findsOneWidget);
      expect(find.text('Results for “ức gà”'), findsOneWidget);
      expect(find.text('Searching...'), findsNothing);

      await tester.pump(const Duration(seconds: 1));
      await tester.pumpAndSettle();
      expect(find.text('No foods found'), findsOneWidget);
    });
  });

  testWidgets('the 30th food is the last: the 31st says why it cannot go in', (
    tester,
  ) async {
    sizeTo(tester, const Size(390, 844));
    await openManualSheet(tester, FakeManualApi(), seed: seededItems(29));
    await tester.ensureVisible(find.text('Add ingredient'));
    await tap(tester, find.text('Add ingredient'));
    await search(tester, 'food');
    await tester.ensureVisible(inAdd(find.text('Food 30')));
    await tester.pumpAndSettle();
    await tap(tester, inAdd(find.text('Food 30')));
    await tap(tester, find.text('Add to meal'));
    expect(find.textContaining('30 ingredients ·'), findsOneWidget);

    await tester.ensureVisible(inAdd(find.text('Food 31')));
    await tester.pumpAndSettle();
    await tap(tester, inAdd(find.text('Food 31')));
    final note = find.text('A meal holds up to 30 ingredients');
    expect(inAdd(note), findsOneWidget);
    expect(find.textContaining('with this'), findsNothing);
    await tap(tester, find.text('Add to meal'));
    // Still on the food page: nothing was added, nothing pretended to be.
    expect(inAdd(note), findsOneWidget);
    expect(find.textContaining('30 ingredients ·'), findsOneWidget);

    // An item already in the meal still updates.
    await tap(tester, inAdd(find.bySemanticsLabel('Back')));
    await tester.ensureVisible(inAdd(find.text('Food 1')));
    await tester.pumpAndSettle();
    await tap(tester, inAdd(find.text('Food 1')));
    await tap(tester, find.bySemanticsLabel('More'));
    await tap(tester, find.text('Update'));
    expect(inAdd(find.text('110 g in meal')), findsOneWidget);

    await tap(tester, find.text('Done'));
    expect(find.text('30 ingredients'), findsOneWidget);
    await tester.ensureVisible(find.text('Add ingredient'));
    await tester.pumpAndSettle();
    expect(note, findsOneWidget);
    await tap(tester, find.text('Add ingredient'));
    expect(find.byType(ManualAddSheet), findsNothing);
  });

  testWidgets('keyboard up: Save and Add to meal stay above it', (
    tester,
  ) async {
    sizeTo(tester, const Size(390, 844));
    tester.view.viewInsets = const FakeViewPadding(bottom: 336);
    addTearDown(tester.view.resetViewInsets);
    await openManualSheet(tester, FakeManualApi(), seed: seededItems(3));
    const keyboardTop = 844 - 336;
    expect(tester.getRect(find.text('Save')).bottom, lessThan(keyboardTop));

    await tester.ensureVisible(find.text('Add ingredient'));
    await tester.pumpAndSettle();
    await tap(tester, find.text('Add ingredient'));
    await tap(tester, inAdd(find.text('Cơm trắng')));
    expect(
      tester.getRect(find.text('Add to meal')).bottom,
      lessThan(keyboardTop),
    );
  });

  testWidgets('Vietnamese: the walk reads in Vietnamese, no raw keys', (
    tester,
  ) async {
    sizeTo(tester, const Size(390, 844));
    await openManualSheet(tester, FakeManualApi(), locale: const Locale('vi'));
    expect(find.text('Ghi thủ công'), findsOneWidget);
    expect(find.text('Không bắt buộc'), findsOneWidget);
    await tap(tester, find.text('Thêm nguyên liệu'));
    expect(find.text('Gần đây'), findsOneWidget);
    await tap(tester, inAdd(find.text('Ức gà')));
    expect(find.text('Thêm vào bữa'), findsOneWidget);
    await tap(tester, find.text('Thêm vào bữa'));
    await tap(tester, find.text('Xong'));
    expect(find.text('Lưu'), findsOneWidget);
    expect(find.textContaining('logging.'), findsNothing);
    expect(find.textContaining('errors.'), findsNothing);
  });

  testWidgets('a long name wraps in results and clamps on the plate at 320', (
    tester,
  ) async {
    sizeTo(tester, const Size(320, 568), 1.3);
    await openManualSheet(tester, FakeManualApi());
    await tap(tester, find.text('Add ingredient'));
    await search(tester, 'bánh mì');
    await tap(tester, inAdd(find.textContaining('Bánh mì kẹp')));
    await tester.ensureVisible(find.text('Add to meal'));
    await tap(tester, find.text('Add to meal'));
    await tap(tester, find.text('Done'));
    expect(find.text('1 ingredient'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
