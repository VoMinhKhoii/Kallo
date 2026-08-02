import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:nham_mobile/features/logging/widgets/meal_entry_item_row.dart';
import 'package:nham_mobile/features/logging/widgets/portion/portion_assumption_line.dart';
import 'package:nham_mobile/features/logging/widgets/portion/portion_picker_sheet.dart';
import 'package:nham_mobile/models/meal.dart';
import 'package:nham_mobile/models/vessel.dart';

import 'l10n_test_loader.dart';

// `FsL10nLoader` is mandatory here: the default loader isolate-decodes en.json
// (>50 KiB) and the reply never arrives inside a widget test's fake-async zone.
Widget _wrap(Widget child) => EasyLocalization(
  supportedLocales: const [Locale('en'), Locale('vi')],
  path: 'assets/l10n',
  fallbackLocale: const Locale('en'),
  assetLoader: const FsL10nLoader(),
  child: Builder(
    builder: (context) => MaterialApp(
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

MealItem _item({ClientVessel? vessel, double quantity = 150}) => MealItem(
  id: 'item-1',
  name: 'cá kho',
  quantity: quantity,
  unit: 'g',
  macros: MacroBreakdown(
    calories: quantity * 2,
    protein: 30,
    carbs: 4,
    fat: 30,
  ),
  vessel: vessel,
);

/// Opens the picker from a plain button and records what it returned.
Future<PortionPick?> _openPicker(
  WidgetTester tester, {
  required ClientVessel vessel,
  required int grams,
}) async {
  PortionPick? result;
  var returned = false;
  await tester.pumpWidget(
    _wrap(
      Builder(
        builder: (context) => TextButton(
          onPressed: () async {
            result = await showPortionPicker(
              context,
              vessel: vessel,
              grams: grams,
              kcalPerGram: 2,
            );
            returned = true;
          },
          child: const Text('open'),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
  expect(returned, isFalse, reason: 'sheet should still be open');
  return result;
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

  group('portion assumption line', () {
    testWidgets('renders the tier label for an item with a vessel', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(
          MealEntryItemRow(
            item: _item(vessel: _fish),
            editing: false,
            onChange: (_, _) {},
            onAdjustPortion: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();
      // 150 g is tier 3 exactly, so the line may claim its name.
      expect(find.text('≈ medium cut'), findsOneWidget);
    });

    testWidgets('states the grams when no tier can be claimed', (tester) async {
      await tester.pumpWidget(
        _wrap(
          MealEntryItemRow(
            item: _item(vessel: _fish, quantity: 200),
            editing: false,
            onChange: (_, _) {},
            onAdjustPortion: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();
      // 200 g is >10% from both 150 g and 250 g — claiming either would lie.
      expect(find.text('≈ 200 g'), findsOneWidget);
    });

    testWidgets('is absent when the item carries no vessel', (tester) async {
      await tester.pumpWidget(
        _wrap(
          MealEntryItemRow(
            item: _item(),
            editing: false,
            onChange: (_, _) {},
            onAdjustPortion: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(PortionAssumptionLine), findsNothing);
    });
  });

  group('portion picker sheet', () {
    testWidgets('opens on the item grams and previews kcal', (tester) async {
      await _openPicker(tester, vessel: _fish, grams: 150);
      expect(find.text('Portion size'), findsOneWidget);
      expect(find.textContaining('150 g'), findsWidgets);
      expect(find.textContaining('300 kcal'), findsOneWidget);
      expect(find.text('medium cut'), findsOneWidget);
    });

    testWidgets('tapping an anchor jumps the preview and Apply commits it', (
      tester,
    ) async {
      PortionPick? result;
      var returned = false;
      await tester.pumpWidget(
        _wrap(
          Builder(
            builder: (context) => TextButton(
              onPressed: () async {
                result = await showPortionPicker(
                  context,
                  vessel: _fish,
                  grams: 150,
                  kcalPerGram: 2,
                );
                returned = true;
              },
              child: const Text('open'),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();

      await tester.tap(find.bySemanticsLabel('fillet (250 g)'));
      await tester.pumpAndSettle();
      expect(find.text('fillet'), findsOneWidget);

      await tester.tap(find.text('Apply'));
      await tester.pumpAndSettle();

      expect(returned, isTrue);
      expect(result?.grams, 250);
      // 250 g is tier 4 — the tier the UI actually claimed.
      expect((result?.vessel as PieceVessel?)?.tier, 4);
    });

    testWidgets('Cancel returns nothing', (tester) async {
      PortionPick? result;
      var returned = false;
      await tester.pumpWidget(
        _wrap(
          Builder(
            builder: (context) => TextButton(
              onPressed: () async {
                result = await showPortionPicker(
                  context,
                  vessel: _fish,
                  grams: 150,
                  kcalPerGram: 2,
                );
                returned = true;
              },
              child: const Text('open'),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();

      expect(returned, isTrue);
      expect(result, isNull);
    });

    testWidgets('the container branch names the nearest tier', (tester) async {
      // A 700 ml medium bowl of soup resolves to ~665 g at the tier-2 anchor.
      await _openPicker(tester, vessel: _bowl, grams: 665);
      expect(find.text('medium bowl · 700 ml'), findsOneWidget);
      expect(find.textContaining('665 g'), findsOneWidget);
    });
  });
}
