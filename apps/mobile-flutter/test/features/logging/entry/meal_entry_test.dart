import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'package:kallo_mobile/features/logging/logic/logging_spacing.dart';
import 'package:kallo_mobile/features/logging/widgets/composer/entrances.dart';
import 'package:kallo_mobile/features/logging/widgets/entry/meal_entry.dart';
import 'package:kallo_mobile/features/logging/widgets/entry/meal_entry_card.dart';
import 'package:kallo_mobile/features/logging/widgets/entry/meal_entry_confirm_button.dart';
import 'package:kallo_mobile/features/logging/widgets/portion/portion_assumption_line.dart';
import 'package:kallo_mobile/models/logging/meal.dart';
import 'package:kallo_mobile/models/nutrition/vessel.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';
import 'package:kallo_mobile/theme/kallo_theme.dart';

import '../../../l10n_test_loader.dart';

import '../../../app_fonts.dart';
import '../actions/hold_to_open_menu.dart';

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
    // Was a hand-rolled loader for Regular ALONE: this file makes real-glyph
    // width assertions, and a missing face is substituted silently.
    await loadAppFonts();
  });

  for (final width in [_phone390, _phone320]) {
    testWidgets('a dish tap opens the edit sheet at ${width.toInt()}pt', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(Size(width, 1400));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await _pumpCard(tester, width: width);

      await tester.tap(find.text('Cơm gà Hải Nam'));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('Edit meal'), findsOneWidget);
      expect(find.text('Done'), findsOneWidget);
      // Every dish of the meal, not just the one tapped.
      expect(find.text('Kem vani'), findsNWidgets(2));
    });
  }

  testWidgets('holding the card offers Edit and Discard', (tester) async {
    await tester.binding.setSurfaceSize(const Size(_phone390, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    var discarded = 0;
    await tester.pumpWidget(
      _wrap(
        MealEntry(
          parsedMeal: _meal,
          rawInput: 'cơm gà',
          onConfirm: (_) {},
          onDiscard: () => discarded++,
        ),
        width: _phone390,
      ),
    );
    await tester.pumpAndSettle();

    await holdToOpenMenu(tester, find.byType(MealEntryCard));
    expect(find.text('Edit'), findsOneWidget);
    expect(find.text('Discard'), findsOneWidget);
    // Nothing sits under Save meal any more — no trash row.
    expect(find.byIcon(LucideIcons.trash2300), findsOneWidget); // the menu's

    await tester.tap(find.text('Discard'));
    await tester.pumpAndSettle();
    // The discard still asks first.
    expect(discarded, 0);
    await tester.tap(find.text('Discard').last);
    await tester.pumpAndSettle();
    expect(discarded, 1);
  });

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
      totalMacros: MacroBreakdown(
        calories: 489,
        protein: 30,
        carbs: 60,
        fat: 10,
      ),
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
        MealEntry(parsedMeal: drifting, rawInput: 'ba món', onConfirm: (_) {}),
        width: _phone390,
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.text('489 kcal'),
      findsOneWidget,
      reason: 'the staged card must show the server total',
    );
    expect(
      find.text('490 kcal'),
      findsNothing,
      reason: 'round-then-sum drift is back',
    );
  });

  group('the total tracks what will actually be SUBMITTED', () {
    /// The server's figure against three items that re-sum to 490 (see the
    /// test above).
    const drifting = ParsedMeal(
      mealName: 'Bữa tối',
      totalMacros: MacroBreakdown(
        calories: 489,
        protein: 30,
        carbs: 60,
        fat: 10,
      ),
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

    /// The card, with its edit sheet open on the first dish.
    Future<void> pumpEditing(WidgetTester tester) async {
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
      await tester.tap(find.text('Món một'));
      await tester.pumpAndSettle();
    }

    Future<void> tapAndSettle(WidgetTester tester, Finder f) async {
      await tester.tap(f);
      await tester.pumpAndSettle();
    }

    testWidgets('a real edit shows the recalculated figure', (tester) async {
      await pumpEditing(tester);

      await tapAndSettle(tester, find.bySemanticsLabel('10 more of Món một'));
      await tapAndSettle(tester, find.text('Done'));

      // 100g → 110g scales the first dish to 179.3, so 506 is the honest sum.
      expect(find.text('506 kcal'), findsOneWidget);
    });

    testWidgets('plus then minus returns to the server figure', (tester) async {
      // The sentinel was `identical(_items, _original)`, and every edit builds
      // a NEW list, no-op or not. So stepping up and back down flipped the display to the
      // round-then-sum figure (490) while `deriveQuantityEdits` reported NO
      // edits: the user watched the number change, confirmed, and the saved
      // card came back at the original.
      await pumpEditing(tester);

      await tapAndSettle(tester, find.bySemanticsLabel('10 more of Món một'));
      await tapAndSettle(tester, find.bySemanticsLabel('10 less of Món một'));
      await tapAndSettle(tester, find.text('Done'));

      expect(
        find.text('489 kcal'),
        findsOneWidget,
        reason: 'nothing is being submitted, so nothing may have changed',
      );
      expect(find.text('490 kcal'), findsNothing);
    });
  });

  testWidgets('a re-staged analysis replaces the card\'s items', (
    tester,
  ) async {
    // StagedMealCard is keyed by `pending.id`, and analysis_run REUSES the
    // attemptId for a retry / cheat-clarify — so a re-staged analysis arrives
    // at the SAME card with a new parsedMeal. Without didUpdateWidget the
    // state seeded at mount stayed, and the card rendered the old dishes.
    await tester.binding.setSurfaceSize(const Size(_phone390, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    const restaged = ParsedMeal(
      mealName: 'Bữa trưa',
      totalMacros: MacroBreakdown(
        calories: 300,
        protein: 20,
        carbs: 30,
        fat: 8,
      ),
      items: [
        MealItem(
          id: 'r1',
          name: 'Bánh mì trứng',
          quantity: 200,
          unit: 'g',
          macros: MacroBreakdown(calories: 300, protein: 20, carbs: 30, fat: 8),
        ),
      ],
    );

    Widget card(ParsedMeal meal) => _wrap(
      MealEntry(parsedMeal: meal, rawInput: 'lại lần nữa', onConfirm: (_) {}),
      width: _phone390,
    );

    await tester.pumpWidget(card(_meal));
    await tester.pumpAndSettle();
    expect(find.text('Cơm gà Hải Nam'), findsOneWidget);

    await tester.pumpWidget(card(restaged));
    await tester.pumpAndSettle();

    expect(find.text('Bánh mì trứng'), findsOneWidget);
    expect(find.text('Cơm gà Hải Nam'), findsNothing);
    // The one dish's row and the totals line, both on the new analysis.
    expect(find.text('300 kcal'), findsNWidgets(2));
    expect(find.text('776 kcal'), findsNothing);
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
                  .widgetList<Container>(find.byType(Container))
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
          MealEntry(parsedMeal: _meal, rawInput: 'cơm gà', onConfirm: (_) {}),
          width: 390,
        ),
      );
      await tester.pump();

      expect(find.byType(FadeInLeft), findsWidgets);
      await tester.pumpAndSettle();
    });
  });

  group('a re-stage that keeps the dish list', () {
    // The cheat clarify and the retry both re-analyse the SAME occasion under
    // the SAME attemptId, so the answer comes back at the same card with the
    // same dish ids at the same grams — and only the numbers moved. Matching
    // on ids and amounts alone called that "unchanged".
    const one = ParsedMeal(
      mealName: 'Bữa trưa',
      totalMacros: MacroBreakdown(
        calories: 300,
        protein: 20,
        carbs: 30,
        fat: 8,
      ),
      items: [
        MealItem(
          id: 'r1',
          name: 'Bánh mì trứng',
          quantity: 200,
          unit: 'g',
          macros: MacroBreakdown(calories: 300, protein: 20, carbs: 30, fat: 8),
        ),
      ],
    );
    // Same dish id, same grams, same CALORIES — only the macro split moved.
    // Matching on ids, quantities and calories alone saw no change at all.
    const reEstimated = ParsedMeal(
      mealName: 'Bữa trưa',
      totalMacros: MacroBreakdown(
        calories: 300,
        protein: 44,
        carbs: 30,
        fat: 8,
      ),
      items: [
        MealItem(
          id: 'r1',
          name: 'Bánh mì trứng',
          quantity: 200,
          unit: 'g',
          macros: MacroBreakdown(calories: 300, protein: 44, carbs: 30, fat: 8),
        ),
      ],
    );

    Widget card(ParsedMeal meal, {DateTime? loggedAt}) => _wrap(
      MealEntry(
        parsedMeal: meal,
        rawInput: 'lại lần nữa',
        loggedAt: loggedAt,
        onConfirm: (_) {},
      ),
      width: _phone390,
    );

    testWidgets('re-seeds the per-item nutrition, not just the total', (
      tester,
    ) async {
      await tester.binding.setSurfaceSize(const Size(_phone390, 1400));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(card(one));
      await tester.pumpAndSettle();
      expect(find.text('20g'), findsNWidgets(2));

      await tester.pumpWidget(card(reEstimated));
      await tester.pumpAndSettle();

      // The dish row AND the totals line. Held stale, the row kept 20g under a
      // totals line reading 44g — a card whose parts did not add up to its sum
      // (the total is read straight off the new [ParsedMeal], the row was not).
      expect(
        find.text('44g'),
        findsNWidgets(2),
        reason: 'the dish row must move with the analysis, not lag it',
      );
      expect(find.text('20g'), findsNothing);
    });

    testWidgets('re-seeds the divider time', (tester) async {
      await tester.binding.setSurfaceSize(const Size(_phone390, 1400));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        card(one, loggedAt: DateTime(2026, 8, 11, 12, 15)),
      );
      await tester.pumpAndSettle();
      expect(find.textContaining('12:15'), findsOneWidget);

      await tester.pumpWidget(
        card(reEstimated, loggedAt: DateTime(2026, 8, 11, 13, 40)),
      );
      await tester.pumpAndSettle();

      // `_enteredAt` was `late final`, so the card kept saying the meal was
      // logged when the attempt it REPLACED was staged.
      expect(find.textContaining('1:40'), findsOneWidget);
      expect(find.textContaining('12:15'), findsNothing);
    });

    testWidgets('a plain refetch of the same analysis keeps its time', (
      tester,
    ) async {
      // The other half of the invariant: a day refetch hands over an
      // equal-but-new ParsedMeal every time, and re-seeding on that would
      // throw away an edit in progress (and, with a null loggedAt, creep the
      // divider forward on every rebuild).
      await tester.binding.setSurfaceSize(const Size(_phone390, 1400));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final at = DateTime(2026, 8, 11, 12, 15);
      await tester.pumpWidget(card(one, loggedAt: at));
      await tester.pumpAndSettle();

      await tester.pumpWidget(
        card(
          const ParsedMeal(
            mealName: 'Bữa trưa',
            totalMacros: MacroBreakdown(
              calories: 300,
              protein: 20,
              carbs: 30,
              fat: 8,
            ),
            items: [
              MealItem(
                id: 'r1',
                name: 'Bánh mì trứng',
                quantity: 200,
                unit: 'g',
                macros: MacroBreakdown(
                  calories: 300,
                  protein: 20,
                  carbs: 30,
                  fat: 8,
                ),
              ),
            ],
          ),
          loggedAt: at,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('12:15'), findsOneWidget);
    });
  });

  testWidgets('a re-stage under an open edit sheet wins', (tester) async {
    // The sheet computes its answer from a SNAPSHOT of the items as they were
    // when it opened. A re-stage replaces the whole analysis under it, and
    // committing the snapshot then would write the superseded meal back over
    // it — a user who opened the sheet just before a retry landed would undo
    // the retry by pressing Done. (The old portion picker shipped exactly that.)
    await tester.binding.setSurfaceSize(const Size(_phone390, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    const vessel = PieceVessel(tier: 3, count: 1, kind: PieceKind.fish);
    const before = ParsedMeal(
      mealName: 'Bữa tối',
      totalMacros: MacroBreakdown(
        calories: 300,
        protein: 30,
        carbs: 4,
        fat: 18,
      ),
      items: [
        MealItem(
          id: 'p1',
          name: 'Cá kho',
          quantity: 150,
          unit: 'g',
          macros: MacroBreakdown(calories: 300, protein: 30, carbs: 4, fat: 18),
          vessel: vessel,
        ),
      ],
    );
    const restaged = ParsedMeal(
      mealName: 'Bữa tối',
      totalMacros: MacroBreakdown(
        calories: 520,
        protein: 52,
        carbs: 7,
        fat: 31,
      ),
      items: [
        MealItem(
          id: 'p1',
          name: 'Cá kho',
          quantity: 260,
          unit: 'g',
          macros: MacroBreakdown(calories: 520, protein: 52, carbs: 7, fat: 31),
          vessel: vessel,
        ),
      ],
    );

    // The meal changes WITHOUT rebuilding the app root — a `pumpWidget` would
    // tear down the Navigator the sheet is living in.
    final meal = ValueNotifier<ParsedMeal>(before);
    addTearDown(meal.dispose);

    await tester.pumpWidget(
      _wrap(
        ValueListenableBuilder<ParsedMeal>(
          valueListenable: meal,
          builder:
              (_, value, _) => MealEntry(
                parsedMeal: value,
                rawInput: 'cá kho',
                onConfirm: (_) {},
              ),
        ),
        width: _phone390,
      ),
    );
    await tester.pumpAndSettle();

    final line = find.byType(PortionAssumptionLine);
    await tester.ensureVisible(line);
    await tester.pumpAndSettle();
    await tester.tap(line);
    await tester.pumpAndSettle();
    expect(find.text('Done'), findsOneWidget);

    // The retry's answer lands while the sheet is up.
    meal.value = restaged;
    await tester.pumpAndSettle();

    // Done commits the sheet's view of a meal that no longer exists.
    await tester.tap(find.text('Done'));
    await tester.pumpAndSettle();

    expect(
      find.text('520 kcal'),
      findsNWidgets(2),
      reason: 'the re-stage must survive a sheet that opened before it',
    );
    expect(find.text('300 kcal'), findsNothing);
  });

  testWidgets('the save pill clears the card instead of welding to it', (
    tester,
  ) async {
    // The gap was LoggingSpacing.actions (2) — the token for the ICON row,
    // which is tiny only because a 44pt icon target carries ~11.5 of centring
    // inset above its glyph. The pill is a filled 50pt block with no inset, so
    // 2 was the whole gap and the card's white met the pill's beige at a seam.
    await _pumpCard(tester, width: 390);

    final card = tester.getRect(find.byType(MealEntryCard));
    final pill = tester.getRect(find.byType(MealEntryConfirmButton));
    expect(
      pill.top - card.bottom,
      LoggingSpacing.turn,
      reason: 'the pill sits on the house step under the card',
    );
  });
}
