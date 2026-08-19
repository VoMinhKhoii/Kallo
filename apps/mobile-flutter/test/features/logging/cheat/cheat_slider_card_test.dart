import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/widgets/cheat/cheat_slider_card.dart';
import 'package:kallo_mobile/models/logging/cheat.dart';

import '../../../l10n_test_loader.dart';

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
          home: Scaffold(body: SingleChildScrollView(child: child)),
        ),
      ),
    );

/// One protein slider (0→120g across the scale) defaulting to level 5 (60g),
/// so the untouched card reads `≈ 240 kcal`.
CheatSliderSpec _spec({CheatClarifyingQuestion? clarify}) => CheatSliderSpec(
      mealSlot: 'dinner',
      confidence: 'medium',
      clarifyingQuestion: clarify,
      sliders: const [
        CheatSlider(
          key: CheatSliderKey.protein,
          label: 'Meat / seafood',
          defaultLevel: 5,
          anchors: [
            CheatSliderAnchor(level: 0, label: 'none', proteinG: 0),
            CheatSliderAnchor(level: 2, label: 'a taste', proteinG: 24),
            CheatSliderAnchor(level: 4, label: 'a plate', proteinG: 48),
            CheatSliderAnchor(level: 6, label: 'seconds', proteinG: 72),
            CheatSliderAnchor(level: 8, label: 'thirds', proteinG: 96),
            CheatSliderAnchor(level: 10, label: 'the feast', proteinG: 120),
          ],
        ),
      ],
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

  testWidgets('renders defaults and updates the kcal readout on slide',
      (tester) async {
    CheatSliderLevels? confirmed;
    await tester.pumpWidget(
      _wrap(
        CheatSliderCard(
          spec: _spec(),
          rawInput: 'Korean BBQ buffet',
          onConfirm: (levels) => confirmed = levels,
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Default level 5 → 60g protein → 4·60 = 240 kcal, ≈-prefixed.
    expect(find.text('Korean BBQ buffet'), findsOneWidget);
    expect(find.textContaining('≈ 240'), findsOneWidget);

    // Drag the slider to the top of its range — 120g → 480 kcal.
    await tester.drag(find.byType(Slider), const Offset(400, 0));
    await tester.pumpAndSettle();
    expect(find.textContaining('≈ 480'), findsOneWidget);

    // Save passes the chosen levels through.
    await tester.tap(find.text('Save meal'));
    expect(confirmed, isNotNull);
    expect(confirmed![CheatSliderKey.protein], 10);
  });

  testWidgets('tapping a stop label jumps the slider there', (tester) async {
    await tester.pumpWidget(
      _wrap(
        CheatSliderCard(
          spec: _spec(),
          rawInput: 'Korean BBQ buffet',
          onConfirm: (_) {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('the feast'));
    await tester.pumpAndSettle();
    expect(find.textContaining('≈ 480'), findsOneWidget);
  });

  testWidgets('clarifying question renders option chips and fires onClarify',
      (tester) async {
    String? answered;
    await tester.pumpWidget(
      _wrap(
        CheatSliderCard(
          spec: _spec(
            clarify: const CheatClarifyingQuestion(
              prompt: 'What kind of party?',
              options: ['BBQ', 'Hotpot'],
            ),
          ),
          rawInput: 'party',
          onConfirm: (_) {},
          onClarify: (answer) => answered = answer,
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Question replaces the sliders entirely.
    expect(find.text('What kind of party?'), findsOneWidget);
    expect(find.byType(Slider), findsNothing);
    expect(find.text('Save meal'), findsNothing);

    await tester.tap(find.text('Hotpot'));
    expect(answered, 'Hotpot');
  });
}
