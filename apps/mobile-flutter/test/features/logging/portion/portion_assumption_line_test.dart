import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/entry/meal_entry_item_row.dart';
import 'package:kallo_mobile/features/logging/widgets/portion/portion_assumption_line.dart';
import 'package:kallo_mobile/models/logging/meal.dart';
import 'package:kallo_mobile/models/nutrition/vessel.dart';

import '../../../l10n_test_loader.dart';

// `FsL10nLoader` is mandatory here: the default loader isolate-decodes en.json
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
            index: 0,
            revealing: false,
            animateIn: true,
            onOpen: () {},
            onOpenSize: () {},
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
            index: 0,
            revealing: false,
            animateIn: true,
            onOpen: () {},
            onOpenSize: () {},
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
            index: 0,
            revealing: false,
            animateIn: true,
            onOpen: () {},
            onOpenSize: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(PortionAssumptionLine), findsNothing);
    });
  });
}
