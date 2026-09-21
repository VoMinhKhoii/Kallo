import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/logging/data/logging_models.dart';
import 'package:kallo_mobile/features/logging/widgets/cheat/cheat_meal_actions.dart';
import 'package:kallo_mobile/features/logging/widgets/persisted/persisted_meal_share_to_circle_button.dart';
import 'package:kallo_mobile/models/logging/cheat.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../l10n_test_loader.dart';

// Cheat meals had no action row at all, which quietly meant two things: no way
// to offer one to a friend, and — because every cheat meal is auto-shared to
// the circle on save — no way to see or undo that share either.

const _sliders = CheatSlidersPersisted(
  spec: CheatSliderSpec(sliders: [], mealSlot: 'dinner', confidence: 'medium'),
  levels: {},
);

PersistedMeal _cheatMeal({CheatSlidersPersisted? sliders = _sliders}) =>
    PersistedMeal(
      id: 'm1',
      rawInput: 'Buffet nướng',
      loggedAt: '2026-08-11T12:15:00.000Z',
      entryMode: 'cheat',
      nutrition: const MealNutrition(caloriesKcal: 1400),
      mealItemGroups: const [],
      cheatSliders: sliders,
    );

Future<void> _pump(WidgetTester tester, PersistedMeal meal) async {
  await tester.pumpWidget(
    ProviderScope(
      child: EasyLocalization(
        supportedLocales: const [Locale('en'), Locale('vi')],
        path: 'assets/l10n',
        assetLoader: const FsL10nLoader(),
        fallbackLocale: const Locale('en'),
        child: Builder(
          builder:
              (context) => MaterialApp(
                localizationsDelegates: context.localizationDelegates,
                supportedLocales: context.supportedLocales,
                locale: context.locale,
                home: Scaffold(body: CheatMealActions(meal: meal)),
              ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
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

  testWidgets('offers the circle toggle the cheat card never had', (
    tester,
  ) async {
    await _pump(tester, _cheatMeal());

    expect(find.byType(PersistedMealShareToCircleButton), findsOneWidget);
  });

  testWidgets('offers the friend share when the sliders are there', (
    tester,
  ) async {
    await _pump(tester, _cheatMeal());

    // By icon, not by widget type: the circle toggle builds its own
    // MealActionIconButton, so a type count cannot tell the two apart.
    expect(find.byIcon(LucideIcons.userPlus300), findsOneWidget);
  });

  testWidgets('hides the friend share when the slider data is gone', (
    tester,
  ) async {
    // Reopening those sliders IS the mechanism — the server refuses without
    // them, so do not offer an action that can only fail.
    await _pump(tester, _cheatMeal(sliders: null));

    expect(find.byIcon(LucideIcons.userPlus300), findsNothing);
    // The circle toggle is unrelated to the sliders and must survive.
    expect(find.byType(PersistedMealShareToCircleButton), findsOneWidget);
  });
}
