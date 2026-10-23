import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'package:kallo_mobile/features/logging/data/logging_models.dart';
import 'package:kallo_mobile/features/logging/widgets/actions/meal_hold_menu.dart';
import 'package:kallo_mobile/features/logging/widgets/persisted/persisted_meal_card.dart';
import 'package:kallo_mobile/features/logging/widgets/persisted/persisted_meal_card_content.dart';
import 'package:kallo_mobile/services/billing/entitlements_provider.dart';
import 'package:kallo_mobile/shared/widgets/dialog/kallo_alert_surface.dart';

import '../../../l10n_test_loader.dart';
import '../actions/hold_to_open_menu.dart';

const _meal = PersistedMeal(
  id: 'm1',
  rawInput: 'chicken burrito bowl, iced latte',
  loggedAt: '2026-10-23T12:40:00Z',
  nutrition: MealNutrition(caloriesKcal: 800),
  mealItemGroups: [
    PersistedMealItemGroup(
      name: 'Chicken burrito bowl',
      order: 0,
      nutrition: MealNutrition(caloriesKcal: 610),
      ingredients: [
        PersistedIngredient(
          id: 'rice',
          ingredientName: 'rice',
          estimatedGrams: 250,
          userFacingUnit: 'g',
          nutrition: MealNutrition(caloriesKcal: 330),
        ),
        PersistedIngredient(
          id: 'chicken',
          ingredientName: 'chicken',
          estimatedGrams: 200,
          userFacingUnit: 'g',
          nutrition: MealNutrition(caloriesKcal: 280),
        ),
      ],
    ),
    PersistedMealItemGroup(
      name: 'Iced latte',
      order: 1,
      nutrition: MealNutrition(caloriesKcal: 190),
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

// Signed out: the action row reads its Premium markers from the entitlement
// snapshot, and a null user resolves that to "free" without a network call.
Widget _wrap(Widget child) => ProviderScope(
  overrides: [entitlementsUserIdProvider.overrideWithValue(null)],
  child: EasyLocalization(
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
              body: Center(
                child: SizedBox(
                  width: 366,
                  child: SingleChildScrollView(child: child),
                ),
              ),
            ),
          ),
    ),
  ),
);

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

  testWidgets('Edit and Remove left the row for the hold menu', (tester) async {
    await tester.pumpWidget(
      _wrap(
        PersistedMealCard(
          meal: _meal,
          onRemove: () {},
          onUpdate: ({required edits, required removeIds}) async {},
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byIcon(LucideIcons.slidersHorizontal300), findsNothing);
    expect(find.byIcon(LucideIcons.trash2300), findsNothing);

    await holdToOpenMenu(tester, find.byType(PersistedMealCardContent));
    expect(find.text('Edit'), findsOneWidget);
    expect(find.text('Remove'), findsOneWidget);

    // The lifted copy lives in the menu's own route, above the page's
    // Material. Without one of its own every Text in it wore Flutter's yellow
    // "no Material" underline — caught on the simulator, not by a test.
    final lifted = find.text('Chicken burrito bowl, iced latte').last;
    expect(
      find.ancestor(of: lifted, matching: find.byType(Material)),
      findsWidgets,
    );
    expect(
      DefaultTextStyle.of(tester.element(lifted)).style.decoration,
      isNot(TextDecoration.underline),
    );
  });

  testWidgets('Edit opens the sheet; Save sends only what changed', (
    tester,
  ) async {
    final sent = <({List<Map<String, dynamic>> edits, List<String> ids})>[];
    await tester.pumpWidget(
      _wrap(
        PersistedMealCard(
          meal: _meal,
          onUpdate: ({required edits, required removeIds}) async {
            sent.add((edits: edits, ids: removeIds));
          },
        ),
      ),
    );
    await tester.pumpAndSettle();

    await holdToOpenMenu(tester, find.byType(PersistedMealCardContent));
    await tester.tap(find.text('Edit'));
    await tester.pumpAndSettle();
    expect(find.text('Edit meal'), findsOneWidget);
    expect(find.text('450 g'), findsOneWidget);

    await tester.tap(
      find.bySemanticsLabel('One more serving of Chicken burrito bowl'),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();

    expect(find.text('Edit meal'), findsNothing);
    expect(sent, hasLength(1));
    expect(sent.single.edits, [
      {'id': 'rice', 'newGrams': 375.0},
      {'id': 'chicken', 'newGrams': 300.0},
    ]);
    expect(sent.single.ids, isEmpty);
  });

  testWidgets('an untouched sheet saves without a request', (tester) async {
    var calls = 0;
    await tester.pumpWidget(
      _wrap(
        PersistedMealCard(
          meal: _meal,
          onUpdate: ({required edits, required removeIds}) async => calls++,
        ),
      ),
    );
    await tester.pumpAndSettle();
    await holdToOpenMenu(tester, find.byType(PersistedMealCardContent));
    await tester.tap(find.text('Edit'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();
    expect(calls, 0);
    expect(find.text('Edit meal'), findsNothing);
  });

  testWidgets('a screen reader gets Edit and Remove without the hold', (
    tester,
  ) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(
      _wrap(
        PersistedMealCard(
          meal: _meal,
          onRemove: () {},
          onUpdate: ({required edits, required removeIds}) async {},
        ),
      ),
    );
    await tester.pumpAndSettle();
    final node = tester.getSemantics(
      find
          .descendant(
            of: find.byType(MealHoldMenu),
            matching: find.byType(PersistedMealCardContent),
          )
          .first,
    );
    final labels = <String>[];
    void collect(SemanticsNode n) {
      final ids = n.getSemanticsData().customSemanticsActionIds ?? const [];
      for (final id in ids) {
        labels.add(CustomSemanticsAction.getAction(id)!.label!);
      }
      n.visitChildren((c) {
        collect(c);
        return true;
      });
    }

    SemanticsNode root = node;
    while (root.parent != null) {
      root = root.parent!;
    }
    collect(root);
    expect(labels, containsAll(['Edit', 'Remove']));
    handle.dispose();
  });

  testWidgets('Remove still asks first', (tester) async {
    var removed = 0;
    await tester.pumpWidget(
      _wrap(PersistedMealCard(meal: _meal, onRemove: () => removed++)),
    );
    await tester.pumpAndSettle();
    await holdToOpenMenu(tester, find.byType(PersistedMealCardContent));
    await tester.tap(find.text('Remove'));
    await tester.pumpAndSettle();
    expect(removed, 0);
    expect(find.byKey(kKalloConfirmSurface), findsOneWidget);
  });

  testWidgets('a tap still opens the card', (tester) async {
    await tester.pumpWidget(_wrap(const PersistedMealCard(meal: _meal)));
    await tester.pumpAndSettle();
    // The hold menu must not swallow the plain tap that opens the dish rows.
    final card = find.byType(PersistedMealCardContent);
    final collapsed = tester.getSize(card).height;
    await tester.tap(find.text('Chicken burrito bowl, iced latte'));
    await tester.pumpAndSettle();
    expect(tester.getSize(card).height, greaterThan(collapsed));
    expect(find.text('Edit'), findsNothing);
  });
}
