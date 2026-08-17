import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nham_mobile/features/logging/logic/label_review.dart';
import 'package:nham_mobile/features/logging/widgets/sheets/label_review_step.dart';
import 'package:nham_mobile/models/nutrition_label.dart';

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

  testWidgets('shows the scanned values, basis, and confidence', (
    tester,
  ) async {
    await pumpStep(tester);

    expect(find.text('Bánh quy Cosy'), findsOneWidget);
    expect(find.text('Per 100 g'), findsOneWidget);
    expect(find.text('Medium — please review'), findsOneWidget);
    expect(find.text('1 gói (30 g)'), findsOneWidget);
    // The amount seeds from the label's basis, not from the serving size.
    expect(find.text('100'), findsOneWidget);
    expect(find.text('480'), findsOneWidget);
  });

  testWidgets('renders only the micronutrients the label printed', (
    tester,
  ) async {
    await pumpStep(tester);

    expect(find.text('Sodium'), findsOneWidget);
    // Never printed on this label — the row must not appear at all.
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

  testWidgets('confirm is blocked until the required macros are filled', (
    tester,
  ) async {
    var confirmed = 0;
    final review = await pumpStep(tester, onConfirm: () => confirmed++);

    await tester.enterText(find.widgetWithText(TextField, '6'), '');
    await tester.pumpAndSettle();
    expect(review.canConfirm, isFalse);
    expect(find.text('Add meal'), findsOneWidget);

    await tester.tap(find.text('Add meal'));
    await tester.pumpAndSettle();
    expect(confirmed, 0);

    await tester.enterText(find.widgetWithText(TextField, '62'), '62');
    await tester.enterText(
      find.byWidgetPredicate(
        (w) => w is TextField && w.controller?.text == '',
      ),
      '6',
    );
    await tester.pumpAndSettle();
    expect(review.canConfirm, isTrue);

    await tester.tap(find.text('Add meal'));
    await tester.pumpAndSettle();
    expect(confirmed, 1);
  });

  testWidgets('an empty manual form asks for an amount in servings', (
    tester,
  ) async {
    final review = await pumpStep(tester, json: null);

    expect(review.unit, 'serving');
    expect(find.text('Scanned packaged food'), findsOneWidget);
    // No scan means no basis/confidence block to show.
    expect(find.text('Values shown'), findsNothing);
    expect(review.canConfirm, isFalse);
  });

  testWidgets('a save in flight hides the way back', (tester) async {
    await pumpStep(tester, saving: true);

    expect(find.text('Back'), findsNothing);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
}
