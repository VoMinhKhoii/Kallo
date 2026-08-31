import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/nutrition/widgets/nutrients/nutrient_rows_card.dart';
import 'package:kallo_mobile/models/nutrition/nutrition.dart';

import '../../../l10n_test_loader.dart';

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

NutrientCardData _sodiumCard({required double? averagePerDay}) =>
    NutrientCardData(
      nutrient: NutritionNutrientKey.sodiumMg,
      labelKey: 'nutrition.nutrients.sodium',
      group: NutrientGroup.mineral,
      averagePerDay: averagePerDay,
      target: 2000,
      targetSource: TargetSource.nasem,
      targetSourceLabelKey: 'nutrition.targetSources.nasem',
      unit: 'mg',
      percentOfTarget: null,
      confidence: 100,
      displayState: ConfidenceDisplayState.normal,
      nutrientType: NutrientType.ceiling,
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

  testWidgets('does not render a missing nutrient value as zero', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(NutrientRowsCard(cards: [_sodiumCard(averagePerDay: null)])),
    );
    await tester.pumpAndSettle();

    expect(find.text('— / 2,000 mg'), findsOneWidget);
    expect(find.text('0 / 2,000 mg'), findsNothing);
  });

  testWidgets('the row reports its figure, never a percentage', (tester) async {
    await tester.pumpWidget(
      _wrap(NutrientRowsCard(cards: [_sodiumCard(averagePerDay: 1500)])),
    );
    await tester.pumpAndSettle();

    expect(find.text('1,500 / 2,000 mg'), findsOneWidget);
    expect(find.textContaining('%'), findsNothing);
  });
}
