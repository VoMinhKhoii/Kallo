import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/logging/data/logging_models.dart';
import 'package:kallo_mobile/features/logging/widgets/feed/feed_meal_card.dart';
import 'package:kallo_mobile/features/logging/widgets/turn/meal_time_divider.dart';
import 'package:kallo_mobile/features/logging/logic/logging_spacing.dart';
import 'package:kallo_mobile/theme/kallo_colors.dart';
import 'package:kallo_mobile/features/logging/widgets/turn/user_message_bubble.dart';

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

const _grouped = PersistedMeal(
  id: 'm3',
  rawInput: _raw,
  loggedAt: '2026-08-11T12:15:00.000Z',
  nutrition: MealNutrition(
    caloriesKcal: 480,
    proteinG: 30,
    carbohydrateG: 50,
    fatG: 12,
  ),
  mealItemGroups: [
    PersistedMealItemGroup(
      name: 'Beef slices',
      order: 0,
      nutrition: MealNutrition(caloriesKcal: 220, proteinG: 24),
      ingredients: [],
    ),
  ],
);

Widget _card(PersistedMeal meal) => FeedMealCard(
  meal: meal,
  onRemove: () {},
  onUpdate: ({required edits, required removeIds}) async {},
  onLogAgain: () async {},
);

Widget _localized(Widget child) => EasyLocalization(
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
        child: Scaffold(body: SingleChildScrollView(child: child)),
      ),
    ),
  ),
);

Widget _wrap(PersistedMeal meal) =>
    ProviderScope(child: _localized(_card(meal)));

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

  testWidgets('an opened card stays open across a Log-screen remount', (
    tester,
  ) async {
    // Log is a full-screen PUSH now, not a kept-alive shell branch: every
    // visit rebuilds the feed from scratch. Expansion must live outside the
    // route (TestFlight regression, 2026-08-31) — same container, fresh tree.
    final container = ProviderContainer();
    addTearDown(container.dispose);
    Widget host(Widget child) => UncontrolledProviderScope(
      container: container,
      child: _localized(child),
    );

    await tester.pumpWidget(host(_card(_grouped)));
    await tester.pumpAndSettle();
    expect(find.text('Beef slices').hitTestable(), findsNothing);

    // The whole meal block is the toggle target.
    await tester.tap(find.text(_raw).last);
    await tester.pumpAndSettle();
    expect(find.text('Beef slices').hitTestable(), findsOneWidget);

    // Leave Log (route popped, subtree disposed) and come back.
    await tester.pumpWidget(host(const SizedBox.shrink()));
    await tester.pumpWidget(host(_card(_grouped)));
    await tester.pumpAndSettle();
    expect(find.text('Beef slices').hitTestable(), findsOneWidget);
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
