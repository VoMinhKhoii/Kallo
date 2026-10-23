import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'package:kallo_mobile/features/logging/data/logging_models.dart';
import 'package:kallo_mobile/features/logging/logic/meal_edit/meal_edit_draft.dart';
import 'package:kallo_mobile/features/logging/logic/meal_edit/meal_edit_sources.dart';
import 'package:kallo_mobile/features/logging/widgets/meal_edit/meal_edit_sheet.dart';
import 'package:kallo_mobile/features/logging/widgets/portion/ruler/portion_ruler_control.dart';
import 'package:kallo_mobile/models/logging/meal.dart';
import 'package:kallo_mobile/models/nutrition/vessel.dart';
import 'package:kallo_mobile/shared/logic/macro_composition.dart';
import 'package:kallo_mobile/shared/widgets/nutrition/composition_bar.dart';

import '../../../l10n_test_loader.dart';

// `FsL10nLoader` is mandatory: the default loader isolate-decodes en.json
// (>50 KiB) and the reply never arrives inside a widget test's fake-async zone.
Widget _wrap(Widget child) => EasyLocalization(
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
          home: Scaffold(body: child),
        ),
  ),
);

const _fish = PieceVessel(tier: 3, count: 1, kind: PieceKind.fish);
const _bowl = ContainerVessel(
  family: ContainerFamily.bowl,
  tier: 2,
  dishClass: DishClass.soup,
);

List<MealItem> _staged(ClientVessel vessel, double grams) => [
  MealItem(
    id: 'a',
    name: 'Cá kho',
    quantity: grams,
    unit: 'g',
    macros: const MacroBreakdown(calories: 300, protein: 30, carbs: 4, fat: 6),
    vessel: vessel,
  ),
];

/// Opens the sheet from a button and records every commit it makes.
Future<List<MealEditDraft>> _open(
  WidgetTester tester,
  MealEditDraft draft, {
  String? sizeOpen,
  Future<void> Function(MealEditDraft)? onCommit,
}) async {
  final commits = <MealEditDraft>[];
  await tester.pumpWidget(
    _wrap(
      Builder(
        builder:
            (context) => TextButton(
              onPressed:
                  () => showMealEditSheet(
                    context,
                    draft: draft,
                    commitLabel: 'Done',
                    sizeOpen: sizeOpen,
                    onCommit:
                        onCommit ??
                        (d) async {
                          commits.add(d);
                        },
                  ),
              child: const Text('open'),
            ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
  return commits;
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

  testWidgets('shows the whole meal, then each dish with its controls', (
    tester,
  ) async {
    final items = _staged(_fish, 150);
    await _open(tester, draftFromStaged(items, items));
    expect(find.text('Edit meal'), findsOneWidget);
    expect(find.text('300'), findsOneWidget); // the hero kcal
    expect(find.text('Whole meal'), findsOneWidget);
    expect(find.text('Servings'), findsOneWidget);
    expect(find.text('Amount'), findsOneWidget);
    expect(find.text('150 g'), findsOneWidget);
    expect(find.text('Size'), findsOneWidget);
    expect(find.text('Medium cut'), findsOneWidget);

    // Under the bar: P at its left end, F at its right, C exactly centred —
    // with "P 30g" wider than "F 6g", which is what pulled C off centre.
    final bar = tester.getRect(find.byType(CompositionBar));
    double textLeft(String t) => tester.getRect(find.text(t)).left;
    double textRight(String t) => tester.getRect(find.text(t)).right;
    expect(tester.getRect(find.byIcon(kMacroIcons['protein']!)).left, bar.left);
    expect(textRight('F 6g'), moreOrLessEquals(bar.right, epsilon: 0.5));
    final c = Rect.fromLTRB(
      tester.getRect(find.byIcon(kMacroIcons['carbohydrate']!)).left,
      0,
      textRight('C 4g'),
      0,
    );
    expect(c.center.dx, moreOrLessEquals(bar.center.dx, epsilon: 0.5));
    expect(textLeft('P 30g'), greaterThan(bar.left));

    // The tier name sits against its chevron, not halfway along the row.
    // Measured on the GLYPHS: the Text's own box spans the whole slot, so its
    // edge sits at the chevron however the words inside it are aligned.
    final paragraph = tester.renderObject<RenderParagraph>(
      find.text('Medium cut'),
    );
    final glyphs = paragraph.getBoxesForSelection(
      const TextSelection(baseOffset: 0, extentOffset: 'Medium cut'.length),
    );
    final inkRight = paragraph.localToGlobal(Offset(glyphs.last.right, 0)).dx;
    final chevron = tester.getRect(find.byIcon(LucideIcons.chevronDown300));
    expect(chevron.left - inkRight, lessThanOrEqualTo(8));
  });

  testWidgets('Whole meal doubles every dish and the total follows', (
    tester,
  ) async {
    final items = _staged(_fish, 150);
    await _open(tester, draftFromStaged(items, items));
    await tester.tap(find.bySemanticsLabel('More of the whole meal'));
    await tester.pumpAndSettle();
    await tester.tap(find.bySemanticsLabel('More of the whole meal'));
    await tester.pumpAndSettle();
    expect(find.text('2×'), findsNWidgets(2)); // Whole meal and Servings
    expect(find.text('300 g'), findsWidgets); // Amount, and the Size line
    expect(find.text('600'), findsOneWidget);
  });

  testWidgets('Size drops open in place; a bowl tap moves the amount', (
    tester,
  ) async {
    final items = _staged(_fish, 150);
    final commits = await _open(tester, draftFromStaged(items, items));
    // Closed: no ruler on screen.
    final fillet = find.bySemanticsLabel('fillet (250 g)');
    expect(fillet, findsNothing);

    await tester.tap(find.text('Size'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(fillet);
    await tester.pumpAndSettle();
    await tester.tap(fillet);
    await tester.pumpAndSettle();
    expect(find.text('250 g'), findsWidgets); // Amount, and the tick under it
    expect(find.text('Fillet'), findsOneWidget);

    await tester.tap(find.text('Done'));
    await tester.pumpAndSettle();
    expect(commits, hasLength(1));
    final out = stagedItemsFrom(commits.single, items, 'en');
    expect(out.single.quantity, 250);
    // 250 g is tier 4 — the tier the UI actually claimed.
    expect((out.single.vessel! as PieceVessel).tier, 4);
    expect(find.text('Edit meal'), findsNothing);
  });

  testWidgets('VoiceOver can activate the steppers', (tester) async {
    final handle = tester.ensureSemantics();
    final items = _staged(_fish, 150);
    await _open(tester, draftFromStaged(items, items));
    // The screen-reader gesture, not a synthetic tap on the button's rect.
    tester.semantics.tap(find.semantics.byLabel('More of the whole meal'));
    await tester.pumpAndSettle();
    expect(find.text('1.5×'), findsNWidgets(2));
    handle.dispose();
  });

  testWidgets('a container dish names the bowl its grams claim', (
    tester,
  ) async {
    // A 700 ml medium bowl of soup resolves to ~665 g at the tier-2 anchor.
    final items = _staged(_bowl, 665);
    await _open(tester, draftFromStaged(items, items), sizeOpen: 'a');
    expect(find.text('Medium bowl'), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp('medium bowl')), findsWidgets);
  });

  testWidgets('closing the sheet commits nothing', (tester) async {
    final items = _staged(_fish, 150);
    final commits = await _open(tester, draftFromStaged(items, items));
    await tester.tap(find.bySemanticsLabel('More of the whole meal'));
    await tester.pumpAndSettle();
    await tester.tapAt(const Offset(20, 20)); // the barrier
    await tester.pumpAndSettle();
    expect(find.text('Edit meal'), findsNothing);
    expect(commits, isEmpty);
  });

  testWidgets('a save in flight cannot be dismissed', (tester) async {
    final items = _staged(_fish, 150);
    final pending = Completer<void>();
    await _open(
      tester,
      draftFromStaged(items, items),
      onCommit: (_) => pending.future,
    );
    await tester.tap(find.text('Done'));
    await tester.pump();
    await tester.tapAt(const Offset(20, 20)); // the barrier
    await tester.pumpAndSettle();
    expect(find.text('Edit meal'), findsOneWidget);
    pending.completeError(Exception('offline'));
    await tester.pumpAndSettle();
    expect(find.text('Edit meal'), findsOneWidget, reason: 'kept to retry');
  });

  testWidgets('opening onto a lower dish scrolls its Size into view', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(390, 700));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final items = [
      for (final id in ['a', 'b', 'c', 'd'])
        MealItem(
          id: id,
          name: 'Dish $id',
          quantity: 150,
          unit: 'g',
          macros: const MacroBreakdown(
            calories: 300,
            protein: 30,
            carbs: 4,
            fat: 6,
          ),
          vessel: _fish,
        ),
    ];
    await _open(tester, draftFromStaged(items, items), sizeOpen: 'd');
    final ruler = tester.getRect(find.byType(PortionRulerControl));
    expect(ruler.bottom, lessThanOrEqualTo(700));
    expect(ruler.top, greaterThanOrEqualTo(0));
  });

  testWidgets('a failed save keeps the sheet open to retry', (tester) async {
    final items = _staged(_fish, 150);
    var calls = 0;
    await _open(
      tester,
      draftFromStaged(items, items),
      onCommit: (_) async {
        calls++;
        throw Exception('offline');
      },
    );
    await tester.tap(find.text('Done'));
    await tester.pumpAndSettle();
    expect(calls, 1);
    expect(find.text('Edit meal'), findsOneWidget);
  });

  testWidgets('on a saved meal, minus at half a serving offers to remove', (
    tester,
  ) async {
    const meal = PersistedMeal(
      id: 'm',
      rawInput: 'lunch',
      loggedAt: '2026-10-23T12:00:00Z',
      nutrition: MealNutrition(),
      mealItemGroups: [
        PersistedMealItemGroup(
          name: 'Rice',
          order: 0,
          nutrition: MealNutrition(),
          ingredients: [
            PersistedIngredient(
              id: 'rice',
              ingredientName: 'rice',
              estimatedGrams: 200,
              userFacingUnit: 'g',
              nutrition: MealNutrition(caloriesKcal: 260),
            ),
          ],
        ),
        PersistedMealItemGroup(
          name: 'Latte',
          order: 1,
          nutrition: MealNutrition(),
          ingredients: [
            PersistedIngredient(
              id: 'latte',
              ingredientName: 'latte',
              estimatedGrams: 350,
              userFacingUnit: 'ml',
              nutrition: MealNutrition(caloriesKcal: 190),
            ),
          ],
        ),
      ],
    );
    final commits = await _open(tester, draftFromPersisted(meal));
    expect(find.text('350 ml'), findsOneWidget);
    await tester.tap(find.bySemanticsLabel('One less serving of Latte'));
    await tester.pumpAndSettle();
    await tester.tap(find.bySemanticsLabel('Remove Latte'));
    await tester.pumpAndSettle();
    expect(find.text('Latte'), findsNothing);

    await tester.tap(find.text('Done'));
    await tester.pumpAndSettle();
    final out = persistedEditFrom(meal, commits.single);
    expect(out.removeIds, ['latte']);
    expect(out.edits, isEmpty);
  });
}
