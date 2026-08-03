import 'dart:io';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:nham_mobile/features/logging/widgets/meal_entry.dart';
import 'package:nham_mobile/models/meal.dart';
import 'package:nham_mobile/theme/nham_theme.dart';

import '../../l10n_test_loader.dart';

/// The two widths the card has to survive: a 390pt phone (iPhone 14/15) and a
/// 320pt one (SE / small Android). Both are the DEVICE width — the card's own
/// gutter and padding come off inside [_wrap].
const double _phone390 = 390;
const double _phone320 = 320;

/// A three-dish meal with a name long enough to need the second line, matching
/// the card that overflowed on device.
const _meal = ParsedMeal(
  mealName: 'Bữa trưa',
  totalMacros: MacroBreakdown(
    calories: 776,
    protein: 51,
    carbs: 105,
    fat: 16,
  ),
  items: [
    MealItem(
      id: 'i1',
      name: 'Kem vani',
      quantity: 80,
      unit: 'g',
      macros: MacroBreakdown(calories: 113, protein: 0, carbs: 16, fat: 5),
    ),
    MealItem(
      id: 'i2',
      name: 'Cơm gà Hải Nam',
      quantity: 330,
      unit: 'g',
      macros: MacroBreakdown(calories: 526, protein: 49, carbs: 61, fat: 9),
    ),
    MealItem(
      id: 'i3',
      name: 'Sữa chua uống berries',
      quantity: 180,
      unit: 'g',
      macros: MacroBreakdown(calories: 137, protein: 2, carbs: 28, fat: 2),
    ),
  ],
);

Widget _wrap(Widget child, {required double width}) => EasyLocalization(
  supportedLocales: const [Locale('en'), Locale('vi')],
  path: 'assets/l10n',
  fallbackLocale: const Locale('en'),
  assetLoader: const FsL10nLoader(),
  child: Builder(
    builder:
        (context) => MaterialApp(
          localizationsDelegates: context.localizationDelegates,
          supportedLocales: context.supportedLocales,
          locale: context.locale,
          home: Scaffold(
            // The feed's own gutter (sp3 either side) around a real phone
            // width. On the 800pt test surface nothing here would ever be
            // tight enough to fail.
            body: Center(
              child: SizedBox(
                width: width - 24,
                child: SingleChildScrollView(child: child),
              ),
            ),
          ),
        ),
  ),
);

Future<void> _pumpCard(WidgetTester tester, {required double width}) async {
  await tester.pumpWidget(
    _wrap(
      MealEntry(
        parsedMeal: _meal,
        rawInput: '1 kem vani, cơm gà Hải Nam, sữa chua uống berries',
        onConfirm: (_) {},
      ),
      width: width,
    ),
  );
  await tester.pumpAndSettle();
}

/// Left edge of every `P:` label on screen — one per item row plus the totals
/// line. A column is true when they are all the same.
List<double> _proteinLabelLefts(WidgetTester tester) => [
  for (final e in find.text('P:').evaluate())
    tester.getRect(find.byWidget(e.widget)).left,
];

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/shared_preferences'),
          (call) async => call.method == 'getAll' ? <String, Object>{} : null,
        );
    await EasyLocalization.ensureInitialized();
    // Measure against the real typeface. With the test font (every glyph one em
    // wide) these widths are fiction, and every claim here is about real ones.
    final loader = FontLoader('BeVietnamPro')..addFont(
      File(
        'assets/google_fonts/BeVietnamPro-Regular.ttf',
      ).readAsBytes().then(ByteData.sublistView),
    );
    await loader.load();
  });

  for (final width in [_phone390, _phone320]) {
    testWidgets('edit mode fits the card at ${width.toInt()}pt', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(Size(width, 1400));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await _pumpCard(tester, width: width);

      await tester.tap(find.text('Edit'));
      await tester.pumpAndSettle();

      // The reported bug: two 36pt steppers, a quantity readout AND the full
      // `P:/C:/F: + kcal` tail together demand more than the card has, so the
      // row overflowed — 12pt on the reporter's device, more on a narrower one.
      expect(tester.takeException(), isNull);
    });

    testWidgets('the dish name survives edit mode at ${width.toInt()}pt', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(Size(width, 1400));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await _pumpCard(tester, width: width);

      final name = find.text('Sữa chua uống berries');
      final relaxed = tester.getSize(name).width;

      await tester.tap(find.text('Edit'));
      await tester.pumpAndSettle();
      tester.takeException(); // the overflow, if the fix regressed

      // Not merely "greater than zero": with the tail's 136pt split still in
      // the row, the name's Expanded collapsed to nothing and EVERY item on
      // the card became an anonymous row of numbers.
      expect(tester.getSize(name).width, greaterThan(relaxed * 0.9));
    });
  }

  testWidgets('the totals line sits in the item rows own columns', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(_phone390, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await _pumpCard(tester, width: _phone390);

    // Three item rows + the totals line. The totals used to be one
    // interpolated `P: 51g  C: 105g  F: 16g` run, which sits wherever its own
    // width puts it — so it never lined up with the rows it sums.
    final lefts = _proteinLabelLefts(tester);
    expect(lefts, hasLength(4));
    expect(lefts.toSet(), hasLength(1), reason: 'P: drifted between rows');
  });

  testWidgets('the kcal column does not move when editing starts', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(_phone390, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await _pumpCard(tester, width: _phone390);

    final kcal = find.text('526 kcal');
    final before = tester.getRect(kcal);

    await tester.tap(find.text('Edit'));
    await tester.pumpAndSettle();
    tester.takeException();

    // Editing gives the P/C/F split's width to the steppers and the name. The
    // calories are what answer "what did that change?", so they stay put —
    // otherwise the number you are watching jumps the moment you tap Edit.
    //
    // The ONE thing that moves them is the edit row's own wash inset, which
    // insets the whole row by sp2 and predates this. Pinning the shift to
    // exactly that is what makes this a claim about the column rather than
    // about nothing: drop the split without a fixed kcal column and the figure
    // slides 136pt right.
    expect(
      tester.getRect(kcal).right,
      closeTo(before.right - NhamSpacing.sp2, 0.01),
    );
  });
}
