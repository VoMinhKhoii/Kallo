import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/nutrition/widgets/nutrients/nutrient_grid_card.dart';
import 'package:kallo_mobile/theme/calm_tokens.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';
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

NutrientCardData _sodiumCard({
  required double? averagePerDay,
  double? percentOfTarget,
  ConfidenceDisplayState displayState = ConfidenceDisplayState.normal,
}) =>
    NutrientCardData(
      nutrient: NutritionNutrientKey.sodiumMg,
      labelKey: 'nutrition.nutrients.sodium',
      group: NutrientGroup.mineral,
      averagePerDay: averagePerDay,
      target: 2000,
      targetSource: TargetSource.nasem,
      targetSourceLabelKey: 'nutrition.targetSources.nasem',
      unit: 'mg',
      percentOfTarget: percentOfTarget,
      confidence: 100,
      displayState: displayState,
      nutrientType: NutrientType.ceiling,
    );

/// The card's own fill — the grid's whole signal.
Color _fill(WidgetTester tester) {
  final box = tester.widget<Container>(
    find
        .descendant(
          of: find.byType(NutrientGridCard),
          matching: find.byType(Container),
        )
        .first,
  );
  return ((box.decoration! as BoxDecoration).color)!;
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

  testWidgets('does not render a missing nutrient value as zero', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(NutrientGridCard(card: _sodiumCard(averagePerDay: null))),
    );
    await tester.pumpAndSettle();

    expect(find.text('— / 2,000 mg'), findsOneWidget);
    expect(find.text('0 / 2,000 mg'), findsNothing);
  });

  testWidgets('a cell leads with the percentage and keeps the absolute', (
    tester,
  ) async {
    // The ROW this replaced deliberately showed no percentage: on one line,
    // beside a full bar, it was a third reading of one fact. In a grid the
    // percentage is the thing being compared across twenty cells, so it leads
    // — and the absolute stays under the bar to be checked once.
    await tester.pumpWidget(
      _wrap(
        NutrientGridCard(
          card: _sodiumCard(averagePerDay: 1500, percentOfTarget: 75),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('75%'), findsOneWidget);
    expect(find.text('1,500 / 2,000 mg'), findsOneWidget);
  });

  testWidgets('a met nutrient fills the whole card green', (tester) async {
    // The reason the grid came back: a page of twenty answers "what still
    // needs attention" by colour, before any figure is read.
    await tester.pumpWidget(
      _wrap(
        NutrientGridCard(
          card: _sodiumCard(averagePerDay: 1900, percentOfTarget: 95),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(_fill(tester), KalloColors.successFaint);
  });

  testWidgets('a nutrient short of its target stays an ordinary card', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        NutrientGridCard(
          card: _sodiumCard(averagePerDay: 800, percentOfTarget: 40),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Not green, and NOT a warning either: being under a ceiling is an
    // ordinary day, and colouring it would make a page of vitamins a page of
    // alarms.
    expect(_fill(tester), kCardSurface);
  });

  testWidgets('a thinly measured nutrient is never greened', (tester) async {
    // It might well be on target; there is not enough data to say so, and a
    // green card is a claim.
    await tester.pumpWidget(
      _wrap(
        NutrientGridCard(
          card: _sodiumCard(
            averagePerDay: 1900,
            percentOfTarget: 95,
            displayState: ConfidenceDisplayState.insufficientData,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(_fill(tester), kCardSurface);
    expect(find.text('limited data'), findsOneWidget);
  });

  testWidgets('a ceiling gone over reads as exceeded, not as met', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        NutrientGridCard(
          card: _sodiumCard(averagePerDay: 2600, percentOfTarget: 130),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('+30%'), findsOneWidget);
    expect(_fill(tester), kCardSurface);
  });
}
