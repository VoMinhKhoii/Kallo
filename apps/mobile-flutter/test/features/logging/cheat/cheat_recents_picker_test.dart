import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/data/logging_providers.dart';
import 'package:kallo_mobile/features/logging/widgets/cheat/cheat_recents_picker.dart';
import 'package:kallo_mobile/features/logging/widgets/composer/meal_input.dart';
import 'package:kallo_mobile/features/logging/widgets/picker/picker_band.dart';
import 'package:kallo_mobile/features/logging/widgets/picker/picker_option.dart';
import 'package:kallo_mobile/features/logging/widgets/relog/mention_text_controller.dart';
import 'package:kallo_mobile/models/logging/cheat.dart';
import 'package:kallo_mobile/services/billing/entitlement_state.dart';
import 'package:kallo_mobile/services/billing/feature_lock.dart';

import '../../../app_fonts.dart';
import '../../../l10n_test_loader.dart';

const _userId = 'u1';

const _occasions = [
  RecentCheatOccasion(
    mealId: 'm1',
    rawInput: 'sushi (cá hồi, cá trứng)',
    loggedAt: '2026-09-27T13:14:00.000Z',
    caloriesKcal: 1240,
  ),
  RecentCheatOccasion(
    mealId: 'm2',
    rawInput: '1 bữa đồ thái (tháp chàm, lẩu)',
    loggedAt: '2026-09-20T12:00:00.000Z',
  ),
];

Widget _host(Widget child) => ProviderScope(
  overrides: [
    recentCheatOccasionsProvider(
      _userId,
    ).overrideWith((ref) async => _occasions),
    premiumLockProvider(PremiumFeature.cheatMeal).overrideWithValue(false),
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
            home: Scaffold(body: child),
          ),
    ),
  ),
);

Future<TextEditingController> _pump(
  WidgetTester tester, {
  bool disabled = false,
  ValueChanged<RecentCheatOccasion>? onSelect,
}) async {
  final text = TextEditingController();
  addTearDown(text.dispose);
  await tester.pumpWidget(
    _host(
      Align(
        alignment: Alignment.bottomCenter,
        child: CheatRecentsPicker(
          userId: _userId,
          text: text,
          disabled: disabled,
          onSelect: onSelect ?? (_) {},
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return text;
}

Future<void> _type(WidgetTester tester, TextEditingController c, String s) =>
    tester.runAsync(() async => c.text = s).then((_) => tester.pump());

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpL10nBinding();
  setUpAll(loadAppFonts);

  testWidgets('lists each occasion with its time and last kcal', (
    tester,
  ) async {
    await _pump(tester);

    expect(find.text('LOG IT AGAIN'), findsOneWidget);
    expect(find.byType(PickerOption), findsNWidgets(2));
    expect(find.text('1,240 kcal'), findsOneWidget);
    // No saved total reads as unknown, never as zero.
    expect(find.text('— kcal'), findsOneWidget);
    expect(find.textContaining('Sep 2'), findsNWidgets(2));
  });

  testWidgets('the field filters it, and a new meal hides it', (tester) async {
    final text = await _pump(tester);

    await _type(tester, text, 'do thai');
    expect(find.byType(PickerOption), findsOneWidget);
    expect(find.text('1 bữa đồ thái (tháp chàm, lẩu)'), findsOneWidget);

    await _type(tester, text, 'Korean BBQ');
    expect(find.byType(PickerBand), findsNothing);
  });

  testWidgets('X closes it until the field is cleared', (tester) async {
    final text = await _pump(tester);

    await tester.tap(find.bySemanticsLabel('Close'));
    await tester.pump();
    expect(find.byType(PickerBand), findsNothing);

    await _type(tester, text, 'sus');
    expect(find.byType(PickerBand), findsNothing);

    await _type(tester, text, '');
    expect(find.byType(PickerBand), findsOneWidget);
  });

  testWidgets('a tap picks the occasion; busy rows do not', (tester) async {
    final picked = <String>[];
    await _pump(tester, onSelect: (o) => picked.add(o.mealId));
    await tester.tap(find.text('sushi (cá hồi, cá trứng)'));
    expect(picked, ['m1']);

    picked.clear();
    await _pump(tester, disabled: true, onSelect: (o) => picked.add(o.mealId));
    await tester.tap(find.text('sushi (cá hồi, cá trứng)'));
    expect(picked, isEmpty);
  });

  for (final (height, band) in [(600.0, true), (150.0, false)]) {
    testWidgets('a ${height}pt dock keeps the field, band shown: $band', (
      tester,
    ) async {
      // The bug this replaced: chips stacked above the input pushed the field
      // under the keyboard. In the popup slot the band yields first — shown
      // when there is room, closed when there is not, the field intact either way.
      final text = MentionTextEditingController();
      addTearDown(text.dispose);
      final input = MealInputController();
      await tester.pumpWidget(
        _host(
          Align(
            alignment: Alignment.bottomCenter,
            child: SizedBox(
              height: height,
              child: MealInput(
                controller: input,
                onSubmit: (_) {},
                textController: text,
                popupSlot: CheatRecentsPicker(
                  userId: _userId,
                  text: text,
                  disabled: false,
                  onSelect: (_) {},
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.byType(TextField), findsOneWidget);
      expect(find.byType(PickerBand), band ? findsOneWidget : findsNothing);
    });
  }
}
