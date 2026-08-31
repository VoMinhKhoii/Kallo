import 'dart:io';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/composer/entrances.dart';
import 'package:kallo_mobile/features/logging/widgets/entry/meal_entry.dart';
import 'package:kallo_mobile/models/logging/meal.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';
import 'package:kallo_mobile/theme/kallo_theme.dart';

import '../../../l10n_test_loader.dart';

/// The two widths the card has to survive: a 390pt phone (iPhone 14/15) and a
/// 320pt one (SE / small Android). Both are the DEVICE width — the card's own
/// gutter and padding come off inside [_wrap].
const double _phone390 = 390;
const double _phone320 = 320;

/// A three-dish meal with a name long enough to need the second line, matching
/// the card that overflowed on device.
const _meal = ParsedMeal(
  mealName: 'Bữa trưa',
  totalMacros: MacroBreakdown(calories: 776, protein: 51, carbs: 105, fat: 16),
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

    testWidgets('editing moves nothing at ${width.toInt()}pt', (tester) async {
      await tester.binding.setSurfaceSize(Size(width, 1400));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await _pumpCard(tester, width: width);

      final name = find.text('Sữa chua uống berries');
      final kcal = find.text('526 kcal');
      // Horizontal only. Rows DO get taller — a stepper carries a 36pt tap
      // target and the P/C/F line it replaces is half that — but the reported
      // complaint was sideways: names changing column when you tap Edit.
      List<double> xs(Finder f) => [
        tester.getRect(f).left,
        tester.getRect(f).right,
      ];
      final nameBefore = xs(name);
      final kcalBefore = xs(kcal);

      await tester.tap(find.text('Edit'));
      await tester.pumpAndSettle();
      tester.takeException(); // the overflow, if the fix regressed

      // The steppers used to sit in FRONT of the name, shoving every dish 112pt
      // right — on a phone there was nothing to shove into, so names collapsed
      // to zero width. They now take the P/C/F block's slot instead, which is
      // the same width whatever is in it, so no column moves.
      expect(xs(name), nameBefore, reason: 'the name changed column');
      expect(xs(kcal), kcalBefore, reason: 'the calories changed column');
      expect(find.text('180'), findsOneWidget, reason: 'no quantity readout');
    });
  }

  testWidgets('the staged total is the server\'s, not a re-sum of the rows', (
    tester,
  ) async {
    // Device QA: a staged card read 490 kcal where the saved card read 489.
    // The API rounds each item's macros once, so adding those rounded figures
    // back up (round-then-sum) drifts from the server's own sum-then-round
    // total — which is already on the wire as `totalMacros`, and is what the
    // saved card renders.
    const drifting = ParsedMeal(
      mealName: 'Bữa tối',
      // The server's figure. The three items below sum to 490.
      totalMacros: MacroBreakdown(calories: 489, protein: 30, carbs: 60, fat: 10),
      items: [
        MealItem(
          id: 'd1',
          name: 'Món một',
          quantity: 100,
          unit: 'g',
          macros: MacroBreakdown(calories: 163, protein: 10, carbs: 20, fat: 3),
        ),
        MealItem(
          id: 'd2',
          name: 'Món hai',
          quantity: 100,
          unit: 'g',
          macros: MacroBreakdown(calories: 163, protein: 10, carbs: 20, fat: 3),
        ),
        MealItem(
          id: 'd3',
          name: 'Món ba',
          quantity: 100,
          unit: 'g',
          macros: MacroBreakdown(calories: 164, protein: 10, carbs: 20, fat: 4),
        ),
      ],
    );

    await tester.binding.setSurfaceSize(const Size(_phone390, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      _wrap(
        MealEntry(
          parsedMeal: drifting,
          rawInput: 'ba món',
          onConfirm: (_) {},
        ),
        width: _phone390,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('489 kcal'), findsOneWidget,
        reason: 'the staged card must show the server total');
    expect(find.text('490 kcal'), findsNothing,
        reason: 'round-then-sum drift is back');
  });

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

  testWidgets('the card says it is editable without a wash on every row', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(_phone390, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await _pumpCard(tester, width: _phone390);

    Border cardBorder() =>
        (tester
                        .widgetList<AnimatedContainer>(
                          find.byType(AnimatedContainer),
                        )
                        .firstWhere(
                          (c) =>
                              (c.decoration as BoxDecoration?)?.borderRadius ==
                              BorderRadius.circular(KalloRadii.card),
                        )
                        .decoration
                    as BoxDecoration)
                .border!
            as Border;

    // Borderless at rest on the native canvas — the ring is drawn transparent
    // so the card never changes size as edit mode arrives.
    expect(cardBorder().top.color, const Color(0x00000000));

    await tester.tap(find.text('Edit'));
    await tester.pumpAndSettle();

    // The grey per-row wash is gone. What signals edit mode is the card's own
    // hairline going to the accent this app already uses for a focused input —
    // said once, in existing vocabulary, without insetting anything.
    expect(cardBorder().top.color, KalloColors.accent40);
  });

  testWidgets('the card is white, including on the reveal', (tester) async {
    await tester.binding.setSurfaceSize(const Size(_phone390, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    for (final revealing in [false, true]) {
      await tester.pumpWidget(
        _wrap(
          MealEntry(
            parsedMeal: _meal,
            rawInput: 'cơm gà',
            onConfirm: (_) {},
            revealing: revealing,
          ),
          width: _phone390,
        ),
      );
      await tester.pumpAndSettle();

      // The reveal path painted `surface` — the CANVAS colour — "to match the
      // streaming card's background". The streaming card is `elev`, white, so
      // the two never matched: what it really did was give a meal awaiting
      // confirmation the same fill as the page behind it, which reads as
      // transparent. Both cards are white; that is what removes the seam.
      final decoration =
          tester
                  .widgetList<AnimatedContainer>(find.byType(AnimatedContainer))
                  .firstWhere(
                    (c) =>
                        (c.decoration as BoxDecoration?)?.borderRadius ==
                        BorderRadius.circular(KalloRadii.card),
                  )
                  .decoration
              as BoxDecoration;
      expect(
        decoration.color,
        KalloColors.elev,
        reason: 'revealing: $revealing',
      );
    }
  });

  group('entrances belong to the live turn, not to every scroll-back', () {
    testWidgets('a card restored from the server mounts at rest', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(
          MealEntry(
            parsedMeal: _meal,
            rawInput: 'cơm gà',
            // A real loggedAt is what marks a card as restored — the live
            // reveal is the only one without it.
            loggedAt: DateTime(2026, 8, 25, 12, 15),
            onConfirm: (_) {},
          ),
          width: 390,
        ),
      );
      // One frame only. The feed recycles its cards, so an entrance here would
      // replay in full every time this card scrolled back into view.
      await tester.pump();

      expect(
        find.byType(FadeInLeft),
        findsNothing,
        reason: 'a restored card has been on the day all along',
      );
      await tester.pumpAndSettle();
    });

    testWidgets('the live turn still staggers its rows in', (tester) async {
      await tester.pumpWidget(
        _wrap(
          MealEntry(
            parsedMeal: _meal,
            rawInput: 'cơm gà',
            onConfirm: (_) {},
          ),
          width: 390,
        ),
      );
      await tester.pump();

      expect(find.byType(FadeInLeft), findsWidgets);
      await tester.pumpAndSettle();
    });
  });
}
