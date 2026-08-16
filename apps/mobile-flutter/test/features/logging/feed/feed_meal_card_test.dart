import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nham_mobile/features/logging/data/logging_models.dart';
import 'package:nham_mobile/features/logging/widgets/feed/feed_meal_card.dart';
import 'package:nham_mobile/features/logging/widgets/turn/meal_time_divider.dart';
import 'package:nham_mobile/features/logging/logic/logging_spacing.dart';
import 'package:nham_mobile/theme/kallo_colors.dart';
import 'package:nham_mobile/features/logging/widgets/turn/user_message_bubble.dart';

import '../../../l10n_test_loader.dart';

const _raw = 'phở bò tái nạm';

const _meal = PersistedMeal(
  id: 'm1',
  rawInput: _raw,
  loggedAt: '2026-08-11T12:15:00.000Z',
  nutrition: MealNutrition(
    caloriesKcal: 480,
    proteinG: 30,
    carbohydrateG: 50,
    fatG: 12,
  ),
  mealItemGroups: [],
);

const _blankInput = PersistedMeal(
  id: 'm2',
  rawInput: '   ',
  loggedAt: '2026-08-11T12:15:00.000Z',
  nutrition: MealNutrition(caloriesKcal: 480),
  mealItemGroups: [],
);

Widget _wrap(PersistedMeal meal) => EasyLocalization(
  supportedLocales: const [Locale('en'), Locale('vi')],
  path: 'assets/l10n',
  fallbackLocale: const Locale('en'),
  assetLoader: const FsL10nLoader(),
  child: Builder(
    builder: (context) => MaterialApp(
      localizationsDelegates: context.localizationDelegates,
      supportedLocales: context.supportedLocales,
      locale: context.locale,
      home: MediaQuery(
        data: const MediaQueryData(disableAnimations: true),
        child: Scaffold(
          body: SingleChildScrollView(
            child: FeedMealCard(
              meal: meal,
              onRemove: () {},
              onUpdate: ({required edits, required removeIds}) async {},
              onLogAgain: () async {},
            ),
          ),
        ),
      ),
    ),
  ),
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

  testWidgets('a saved meal keeps the user message that produced it', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(_meal));
    await tester.pumpAndSettle();

    // Saving used to drop the bubble, so the words the user typed vanished the
    // moment the meal was stored — the conversation turned into a list.
    expect(find.byType(UserMessageBubble), findsOneWidget);
    expect(find.byType(MealTimeDivider), findsOneWidget);
    // Twice: the bubble, and the card's own quote (which is also its
    // expand/collapse tap target).
    expect(find.text(_raw), findsNWidgets(2));
  });

  testWidgets('the bubble sits between the divider and the card', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(_meal));
    await tester.pumpAndSettle();

    final divider = tester.getRect(find.byType(MealTimeDivider));
    final bubble = tester.getRect(find.byType(UserMessageBubble));
    expect(divider.bottom, lessThanOrEqualTo(bubble.top));
  });

  testWidgets('a meal with nothing to quote shows the divider alone', (
    tester,
  ) async {
    // Not every staged meal has typed words behind it.
    await tester.pumpWidget(_wrap(_blankInput));
    await tester.pumpAndSettle();

    expect(find.byType(MealTimeDivider), findsOneWidget);
    expect(find.byType(UserMessageBubble), findsNothing);
  });

  testWidgets('divider, message and card sit on one rhythm', (tester) async {
    await tester.pumpWidget(_wrap(_meal));
    await tester.pumpAndSettle();

    final divider = tester.getRect(find.byType(MealTimeDivider));
    final bubble = tester.getRect(find.byType(UserMessageBubble));
    final card = tester.getRect(
      find
          .byWidgetPredicate(
            (w) =>
                w is DecoratedBox &&
                w.decoration is BoxDecoration &&
                (w.decoration as BoxDecoration).color == KalloColors.elev,
          )
          .first,
    );

    // One beat for the whole turn. Any difference between these reads as a
    // mistake rather than as hierarchy, so they are asserted equal — not
    // merely "roughly right".
    expect(bubble.top - divider.bottom, closeTo(LoggingSpacing.turn, 0.5));
    expect(card.top - bubble.bottom, closeTo(LoggingSpacing.turn, 0.5));
  });
}
