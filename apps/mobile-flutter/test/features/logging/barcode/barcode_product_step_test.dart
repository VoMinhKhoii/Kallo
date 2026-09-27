import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/logging/logic/relog/scan_purpose.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/barcode/barcode_product_step.dart';
import 'package:kallo_mobile/models/nutrition/barcode_product.dart';

import '../../../l10n_test_loader.dart';

// No photo: the header's network image is not what these cases are about,
// and `flutter test` has no cache-manager platform side to load it through.
const _coconutWater = BarcodeProduct(
  barcode: '8938507849131',
  name: 'Coconut Water',
  brand: 'Coco Xim',
  caloriesKcal: 16,
  proteinG: 0,
  carbohydrateG: 4,
  fatG: 0,
  sodiumMg: 39,
  servingSizeG: 330,
  packageSizeG: 1000,
  amountUnit: 'ml',
  micronutrients: {'calciumMg': 10, 'potassiumMg': 170},
);

Widget _host(Widget child) => EasyLocalization(
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

void main() {
  setUpAll(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/shared_preferences'),
          (call) async => call.method == 'getAll' ? <String, Object>{} : null,
        );
    await EasyLocalization.ensureInitialized();
  });

  Future<List<int>> pumpStep(
    WidgetTester tester,
    BarcodeProduct product,
  ) async {
    final confirmed = <int>[];
    await tester.pumpWidget(
      _host(
        BarcodeProductStep(
          product: product,
          saving: false,
          purpose: ScanPurpose.log,
          onBack: () {},
          onConfirm: confirmed.add,
        ),
      ),
    );
    await tester.pumpAndSettle();
    return confirmed;
  }

  testWidgets('measures a drink in millilitres everywhere on the sheet', (
    tester,
  ) async {
    await pumpStep(tester, _coconutWater);

    expect(find.text('Nutrition for 330ml'), findsOneWidget);
    expect(find.text('330ml per serving · 330ml total'), findsOneWidget);
    expect(find.text('Millilitres'), findsOneWidget);
    expect(find.textContaining('g total'), findsNothing);

    await tester.tap(find.text('Millilitres'));
    await tester.pumpAndSettle();
    expect(find.text('250ml'), findsOneWidget);
  });

  testWidgets('keeps grams for a food', (tester) async {
    await pumpStep(
      tester,
      const BarcodeProduct(
        barcode: '8934563138162',
        name: 'Hảo Hảo',
        brand: 'Acecook',
        caloriesKcal: 350,
        servingSizeG: 75,
      ),
    );

    expect(find.text('Nutrition for 75g'), findsOneWidget);
    expect(find.text('Grams'), findsOneWidget);
  });

  testWidgets('lists the other nutrients for Premium, scaled to the amount', (
    tester,
  ) async {
    await pumpStep(tester, _coconutWater);

    await tester.tap(find.text('Other nutrients on the label (3)'));
    await tester.pumpAndSettle();

    // 330 ml of a per-100ml label: ×3.3.
    expect(find.text('Sodium'), findsOneWidget);
    expect(find.text('128.7 mg'), findsOneWidget);
    expect(find.text('Calcium'), findsOneWidget);
    expect(find.text('33 mg'), findsOneWidget);
    expect(find.text('561 mg'), findsOneWidget);
  });

  testWidgets('shows nothing extra to an account the server stripped', (
    tester,
  ) async {
    await pumpStep(
      tester,
      const BarcodeProduct(
        barcode: '8938507849131',
        name: 'Coconut Water',
        brand: 'Coco Xim',
        caloriesKcal: 16,
        servingSizeG: 330,
        amountUnit: 'ml',
      ),
    );

    expect(find.textContaining('Other nutrients on the label'), findsNothing);
    expect(find.text('Photo: Open Food Facts'), findsNothing);
  });
}
