import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/logging/data/logging_models.dart';
import 'package:kallo_mobile/features/logging/widgets/feed/staged_meal_card.dart';
import 'package:kallo_mobile/features/logging/widgets/turn/meal_time_divider.dart';
import 'package:kallo_mobile/features/logging/widgets/turn/user_message_bubble.dart';
import 'package:kallo_mobile/models/logging/meal.dart';

import '../../../l10n_test_loader.dart';

const _meal = ParsedMeal(
  mealName: 'Bữa trưa',
  totalMacros: MacroBreakdown(calories: 480, protein: 30, carbs: 50, fat: 12),
  items: [
    MealItem(
      id: 'i1',
      name: 'Phở bò',
      quantity: 1,
      unit: 'bát',
      macros: MacroBreakdown(calories: 480, protein: 30, carbs: 50, fat: 12),
    ),
  ],
);

Widget _wrap(
  PendingMealConfirmation pending, {
  VoidCallback? onDiscard,
  bool busy = false,
}) => EasyLocalization(
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
            child: StagedMealCard(
              pending: pending,
              busy: busy,
              onConfirm: (_, _) {},
              onConfirmCheat: (_, _) {},
              onDiscard: onDiscard ?? () {},
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

  testWidgets('is stamped when it was STAGED, not when it mounted', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        const PendingMealConfirmation(
          id: 'p1',
          rawInput: 'cơm gà',
          // 12:15 local, staged well before this card ever mounted.
          loggedAt: '2026-08-11T12:15:00.000',
          parsedMeal: _meal,
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Reading the clock here showed an hour-old pending meal as "just now".
    // Matched on the widget's own value, not on find.text: intl separates the
    // meridiem with U+202F, so a plain-space literal never matches.
    final divider = tester.widget<MealTimeDivider>(
      find.byType(MealTimeDivider),
    );
    expect(divider.time, startsWith('12:15'));
  });

  testWidgets('wears the same turn header as a saved meal', (tester) async {
    await tester.pumpWidget(
      _wrap(
        const PendingMealConfirmation(
          id: 'p1',
          rawInput: 'cơm gà',
          loggedAt: '2026-08-11T12:00:00.000Z',
          parsedMeal: _meal,
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Every meal in the feed reads the same way — divider, the user's words as
    // a sent message, then the card, which keeps its own quote.
    expect(find.byType(UserMessageBubble), findsOneWidget);
    expect(find.byType(MealTimeDivider), findsOneWidget);
    expect(find.text('cơm gà'), findsNWidgets(2));
  });

  testWidgets('can be thrown away, once the confirm is answered', (
    tester,
  ) async {
    var discarded = 0;
    await tester.pumpWidget(
      _wrap(
        const PendingMealConfirmation(
          id: 'p1',
          rawInput: 'cơm gà',
          loggedAt: '2026-08-11T12:00:00.000Z',
          parsedMeal: _meal,
        ),
        onDiscard: () => discarded++,
      ),
    );
    await tester.pumpAndSettle();

    // Before this the only exit from a staged card was confirming it: the user
    // had to save a meal they did not want in order to be able to delete it.
    await tester.tap(find.bySemanticsLabel('Discard'));
    await tester.pumpAndSettle();
    expect(discarded, 0, reason: 'the confirm must come first');

    await tester.tap(
      find.descendant(of: find.byType(Dialog), matching: find.text('Agree')),
    );
    await tester.pumpAndSettle();
    expect(discarded, 1);
  });

  testWidgets('keeps the discard shut while a confirm is in flight', (
    tester,
  ) async {
    var discarded = 0;
    await tester.pumpWidget(
      _wrap(
        const PendingMealConfirmation(
          id: 'p1',
          rawInput: 'cơm gà',
          loggedAt: '2026-08-11T12:00:00.000Z',
          parsedMeal: _meal,
        ),
        onDiscard: () => discarded++,
        busy: true,
      ),
    );
    await tester.pumpAndSettle();

    // The row is mid-save. Deleting it now would race the confirm.
    await tester.tap(find.bySemanticsLabel('Discard'), warnIfMissed: false);
    await tester.pumpAndSettle();

    expect(find.byType(Dialog), findsNothing);
    expect(discarded, 0);
  });
}
