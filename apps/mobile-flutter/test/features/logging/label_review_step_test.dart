import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/logging/logic/label/review.dart';
import 'package:kallo_mobile/features/logging/widgets/sheets/label/review/label_review_step.dart';
import 'package:kallo_mobile/models/nutrition_label.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';

import '../../l10n_test_loader.dart';

const _labelJson = <String, dynamic>{
  'basis': 'per_100g',
  'confidence': 'medium',
  'labelEvidence': 'Thông tin dinh dưỡng',
  'productName': 'Bánh quy Cosy',
  'servingSize': {'value': 30, 'unit': 'g'},
  'servingSizeDescription': '1 gói (30 g)',
  'servingsPerContainer': 5,
  'per100g': {
    'calories': 480,
    'proteinGrams': 6,
    'carbsGrams': 62,
    'fatGrams': 22,
    'sodiumMg': 320,
  },
};

Widget _host(Widget child) => EasyLocalization(
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

void main() {
  setUpAll(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/shared_preferences'),
          (call) async => call.method == 'getAll' ? <String, Object>{} : null,
        );
    await EasyLocalization.ensureInitialized();
  });

  LabelReviewState reviewFor(Map<String, dynamic>? json) => LabelReviewState(
    json == null ? null : NutritionLabel.fromJson(json),
    defaultProductName: 'Scanned packaged food',
  );

  Future<LabelReviewState> pumpStep(
    WidgetTester tester, {
    Map<String, dynamic>? json = _labelJson,
    bool saving = false,
    VoidCallback? onConfirm,
    VoidCallback? onBack,
  }) async {
    final review = reviewFor(json);
    await tester.pumpWidget(
      _host(
        LabelReviewStep(
          review: review,
          saving: saving,
          onBack: onBack ?? () {},
          onConfirm: onConfirm ?? () {},
        ),
      ),
    );
    // A save in flight spins a CircularProgressIndicator forever, so
    // pumpAndSettle would never return.
    if (saving) {
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));
    } else {
      await tester.pumpAndSettle();
    }
    return review;
  }

  testWidgets('leads with the calorie figure, then the macros', (
    tester,
  ) async {
    await pumpStep(tester);

    expect(find.text('Bánh quy Cosy'), findsOneWidget);
    // The amount seeds from the label's basis, not from the serving size.
    expect(find.text('100'), findsOneWidget);
    expect(find.text('480'), findsOneWidget);
    // Calories are THE figure: 40pt hero, not one boxed field among four.
    final calories = tester.widget<TextField>(
      find.widgetWithText(TextField, '480'),
    );
    expect(calories.style?.fontSize, 40);
    for (final macro in ['6', '62', '22']) {
      final field = tester.widget<TextField>(
        find.widgetWithText(TextField, macro),
      );
      expect(field.style?.fontSize, 17);
    }
  });

  testWidgets('states provenance as one line, not a table', (tester) async {
    await pumpStep(tester);

    // Basis · serving · confidence, joined — and confidence is named only
    // because this label scanned as medium.
    expect(
      find.text('Per 100 g · 1 gói (30 g) · Medium — please review'),
      findsOneWidget,
    );
  });

  testWidgets('keeps the micronutrients folded away until asked for', (
    tester,
  ) async {
    await pumpStep(tester);

    // One printed micronutrient on this label, named in the toggle's count.
    expect(find.text('Other nutrients on the label (1)'), findsOneWidget);
    expect(find.text('Sodium'), findsNothing);

    await tester.tap(find.text('Other nutrients on the label (1)'));
    await tester.pumpAndSettle();

    expect(find.text('Sodium'), findsOneWidget);
    // Never printed on this label — no row for it even when expanded.
    expect(find.text('Iron'), findsNothing);
    expect(find.text('Vitamin B12'), findsNothing);
  });

  testWidgets('a shortcut tap rescales every nutrient field', (tester) async {
    final review = await pumpStep(tester);

    // "1 serving" is 30 g against a per-100 g label — 0.3x.
    await tester.tap(find.text('1 serving'));
    await tester.pumpAndSettle();

    expect(review.amountText, '30');
    expect(find.text('144'), findsOneWidget); // 480 kcal * 0.3
    expect(review.nutrientValue('sodiumMg'), 96);
  });

  testWidgets('marks the four macros required, and nothing else', (
    tester,
  ) async {
    await pumpStep(tester);

    // Calories, protein, carbs, fat. Sodium is optional and unmarked — and
    // folded away besides.
    expect(find.text(' *'), findsNWidgets(4));
  });

  testWidgets('confirm stays tappable and reports the gap on the attempt', (
    tester,
  ) async {
    var confirmed = 0;
    final review = await pumpStep(tester, onConfirm: () => confirmed++);

    await tester.enterText(find.widgetWithText(TextField, '6'), '');
    await tester.pumpAndSettle();
    expect(review.canConfirm, isFalse);

    // The button is live — tapping it is how the user learns what is missing.
    await tester.tap(find.text('Add meal'));
    await tester.pumpAndSettle();
    expect(confirmed, 0);

    // The field carries its own error now — red figure over a red rule, no
    // box and no sentence under the button.
    final protein = tester.widget<TextField>(
      find.byWidgetPredicate((w) => w is TextField && w.controller?.text == ''),
    );
    expect(protein.style?.color, KalloColors.danger);

    await tester.enterText(
      find.byWidgetPredicate((w) => w is TextField && w.controller?.text == ''),
      '6',
    );
    await tester.pumpAndSettle();
    expect(review.canConfirm, isTrue);

    await tester.tap(find.text('Add meal'));
    await tester.pumpAndSettle();
    expect(confirmed, 1);
  });

  testWidgets('gives calories its own row and the macros a shared one', (
    tester,
  ) async {
    await pumpStep(tester);

    final calories = tester.getRect(find.widgetWithText(TextField, '480'));
    final protein = tester.getRect(find.widgetWithText(TextField, '6'));
    final carbs = tester.getRect(find.widgetWithText(TextField, '62'));
    final fat = tester.getRect(find.widgetWithText(TextField, '22'));

    // Calories spans the full width, above the trio.
    expect(calories.width, greaterThan(protein.width * 2));
    expect(calories.bottom, lessThanOrEqualTo(protein.top));
    // Protein / carbs / fat share one line.
    expect(protein.top, carbs.top);
    expect(carbs.top, fat.top);
    expect(protein.left, lessThan(carbs.left));
    expect(carbs.left, lessThan(fat.left));
  });

  testWidgets('an empty manual form asks for an amount in servings', (
    tester,
  ) async {
    final review = await pumpStep(tester, json: null);

    expect(review.unit, 'serving');
    expect(find.text('Scanned packaged food'), findsOneWidget);
    // No scan means no provenance line to show.
    expect(find.textContaining('Per 100 g'), findsNothing);
    expect(review.canConfirm, isFalse);
  });

  testWidgets('a save in flight hides the way back', (tester) async {
    await pumpStep(tester, saving: true);

    expect(find.text('Back'), findsNothing);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
}
