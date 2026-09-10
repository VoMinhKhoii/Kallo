import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'package:kallo_mobile/features/nutrition/widgets/nutrients/nutrient_grid_card.dart';
import 'package:kallo_mobile/theme/calm_tokens.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';
import 'package:kallo_mobile/theme/kallo_theme.dart';
import 'package:kallo_mobile/models/nutrition/nutrition.dart';

import '../../../l10n_test_loader.dart';
import '../nutrient_test_fixtures.dart';

Widget _wrap(Widget child, {Locale? locale}) => EasyLocalization(
  supportedLocales: const [Locale('en'), Locale('vi')],
  path: 'assets/l10n',
  fallbackLocale: const Locale('en'),
  startLocale: locale,
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
      _wrap(NutrientGridCard(card: sodiumCard(averagePerDay: null))),
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
          card: sodiumCard(averagePerDay: 1500, percentOfTarget: 75),
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
          card: sodiumCard(averagePerDay: 1900, percentOfTarget: 95),
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
          card: sodiumCard(averagePerDay: 800, percentOfTarget: 40),
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
          card: sodiumCard(
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
          card: sodiumCard(averagePerDay: 2600, percentOfTarget: 130),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('+30%'), findsOneWidget);
    expect(_fill(tester), kCardSurface);
  });

  testWidgets('a phrase-length figure ellipses before the name does', (
    tester,
  ) async {
    // The figure is not always a percentage. In Vietnamese "no target" is
    // "chưa có mục tiêu" — ~106pt of a cell's ~153 — and as a bare Text it
    // took its intrinsic width first, leaving the label ~39pt: "Beta-…".
    // The name is what identifies the cell, so it is the one that must hold.
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      _wrap(
        // The width a card is actually handed on a 390pt phone: the page's
        // sp3 insets, then half of what is left less the grid's sp3 gutter.
        SizedBox(
          width: (390 - 24 - 12) / 2,
          child: NutrientGridCard(
            // A reading with no target: the figure becomes a phrase.
            card: sodiumCard(
              averagePerDay: 1500,
              labelKey: 'nutrition.nutrients.betaCarotene',
            ),
          ),
        ),
        locale: const Locale('vi'),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('chưa có mục tiêu'), findsOneWidget);
    expect(tester.getSize(find.text('Beta-carotene')).width, greaterThan(70));
  });

  testWidgets("the figure sits flush with the card's right edge", (
    tester,
  ) async {
    // The figure used to hang in a shrink-wrapped Row inside its Flexible
    // slot, so it sat at the START of that slot — on a phone "80%" landed
    // ~90px shy of the card's own padding edge, reading as a stray middle
    // column rather than the right-hand figure of a two-column head.
    await tester.pumpWidget(
      _wrap(
        NutrientGridCard(
          card: sodiumCard(averagePerDay: 1500, percentOfTarget: 75),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // The card's one hairline is drawn outside its sp3 padding, so the
    // content edge is a border-width further in than the card's own edge.
    const hairline = 1.0;
    expect(
      tester.getTopRight(find.text('75%')).dx,
      tester.getTopRight(find.byType(NutrientGridCard)).dx -
          KalloSpacing.sp3 -
          hairline,
    );
    expect(tester.widget<Text>(find.text('75%')).textAlign, TextAlign.end);
  });

  testWidgets('a met nutrient draws no check glyph', (tester) async {
    // The fill IS the signal now: a met card is a green card, and a tick
    // repeating that inside it only crowded the figure it sat beside.
    await tester.pumpWidget(
      _wrap(
        NutrientGridCard(
          card: sodiumCard(averagePerDay: 1900, percentOfTarget: 95),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byIcon(LucideIcons.check300), findsNothing);
  });

  testWidgets('a met nutrient says so to a screen reader', (tester) async {
    // Fill and glyph are both invisible to a screen reader; without this the
    // one thing the grid exists to show is the one thing it never says.
    await tester.pumpWidget(
      _wrap(
        NutrientGridCard(
          card: sodiumCard(averagePerDay: 1900, percentOfTarget: 95),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final node = tester.getSemantics(find.byType(NutrientGridCard));
    expect(node.label, endsWith(', target met'));
  });
}
