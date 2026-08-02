import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:nham_mobile/data/api_client.dart';
import 'package:nham_mobile/features/logging/logic/feed/view_state.dart';
import 'package:nham_mobile/features/logging/logic/meal_log_mode.dart';
import 'package:nham_mobile/features/logging/logic/relog/slash_picker_state.dart';
import 'package:nham_mobile/features/logging/logic/relog/slash_token.dart';
import 'package:nham_mobile/features/logging/widgets/feed/feed_composer.dart';
import 'package:nham_mobile/features/logging/widgets/meal_input.dart';
import 'package:nham_mobile/features/logging/widgets/meal_input_controls.dart';
import 'package:nham_mobile/features/logging/widgets/relog/mention_text_controller.dart';
import 'package:nham_mobile/features/logging/widgets/relog/relog_picker_option.dart';
import 'package:nham_mobile/features/logging/widgets/relog/relog_staged_list.dart';
import 'package:nham_mobile/models/cheat.dart';
import 'package:nham_mobile/models/relog.dart';

import '../../../l10n_test_loader.dart';

class _FakeApiClient extends ApiClient {
  @override
  Future<T> get<T>(String path) async => _candidatesJson as T;
}

const _candidatesJson = {
  'dishes': [
    {
      'kind': 'dish',
      'sourceMealId': 'meal-1',
      'mealItemOrder': 0,
      'name': 'Phở bò',
      'ingredientCount': 4,
      'occurrenceCount': 7,
      'lastLoggedAt': '2026-07-01T00:00:00.000Z',
      'caloriesKcal': 410,
      'proteinG': 20,
      'carbohydrateG': 60,
      'fatG': 10,
    },
  ],
  'meals': [
    {
      'kind': 'meal',
      'sourceMealId': 'meal-9',
      'name': 'bún chả với trà đá',
      'dishCount': 2,
      'occurrenceCount': 1,
      'lastLoggedAt': '2026-06-30T00:00:00.000Z',
      'caloriesKcal': 700,
    },
  ],
};

const _view = FeedViewState(
  persistedMeals: [],
  pendingConfirmations: [],
  isLoading: false,
  hasError: false,
  hasUnknownDailyMacros: false,
  isStreaming: false,
  isRevealing: false,
  isCheatRevealing: false,
  dailyCalories: 0,
  dailyProtein: 0,
  dailyCarbs: 0,
  dailyFat: 0,
  hasFailedAttempt: false,
  isEmpty: true,
  hasFooterItems: false,
  showPartialDayNotice: false,
);

Widget _wrap(Widget child) => ProviderScope(
  overrides: [apiClientProvider.overrideWithValue(_FakeApiClient())],
  child: EasyLocalization(
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
  ),
);

/// Stage a pick into [controller] the way the composer does.
void _stage(MentionTextEditingController controller, String name) {
  const value = '/x';
  controller.value = const TextEditingValue(
    text: value,
    selection: TextSelection.collapsed(offset: value.length),
  );
  controller.addMention(
    RelogDishCandidate(
      sourceMealId: 'meal-1',
      name: name,
      occurrenceCount: 1,
      lastLoggedAt: '2026-07-01T00:00:00.000Z',
      summary: const RelogMacroSummary(
        caloriesKcal: 410,
        proteinG: 20,
        carbohydrateG: 60,
        fatG: 10,
      ),
      mealItemOrder: 0,
      ingredientCount: 3,
    ),
    parseSlashToken(value, value.length)!,
    'stage-1',
  );
}

/// A parent that never rebuilds its child — like FeedArea between setStates.
/// Without it the enclosing pump would refresh the panel for free and hide a
/// missing listener.
class _StaticHost extends StatefulWidget {
  const _StaticHost({required this.child});
  final Widget child;

  @override
  State<_StaticHost> createState() => _StaticHostState();
}

class _StaticHostState extends State<_StaticHost> {
  @override
  Widget build(BuildContext context) => widget.child;
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

  late MentionTextEditingController textController;
  late MealInputController inputController;
  RelogCandidate? selected;
  String? removed;

  setUp(() {
    textController = MentionTextEditingController();
    inputController = MealInputController();
    selected = null;
    removed = null;
  });
  tearDown(() => textController.dispose());

  Widget composer({
    String? relogQuery,
    MealLogMode mode = MealLogMode.normal,
  }) => _wrap(
    FeedComposer(
      view: _view,
      calorieTarget: 2000,
      errorText: null,
      mode: mode,
      cheatIntensity: CheatIntensity.medium,
      onCheatIntensityChange: (_) {},
      userId: 'user-1',
      stagingRepeat: false,
      onRepeatCheat: (_) {},
      controller: inputController,
      onSubmit: (_) {},
      onCancel: () {},
      analyzing: false,
      onModePressed: () {},
      onBarcodePressed: () {},
      onHeightChanged: (_) {},
      onDismissNotice: () {},
      noticeDismissed: true,
      textController: textController,
      onSync: () {},
      onRemoveStaged: (id) => removed = id,
      relogQuery: relogQuery,
      onSelectRelog: (c) => selected = c,
      onDismissRelog: () {},
    ),
  );

  testWidgets('an open token lists past dishes then meals', (tester) async {
    await tester.pumpWidget(composer(relogQuery: ''));
    await tester.pumpAndSettle();

    expect(find.text('Phở bò'), findsOneWidget);
    expect(find.text('bún chả với trà đá'), findsOneWidget);
    // Dishes group before meals — the order the picker offers them in.
    expect(find.text('DISHES'), findsOneWidget);
    expect(find.text('MEALS'), findsOneWidget);
  });

  testWidgets('tapping a row hands the candidate back', (tester) async {
    await tester.pumpWidget(composer(relogQuery: ''));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Phở bò'));
    await tester.pumpAndSettle();

    expect(selected, isNotNull);
    expect(selected!.name, 'Phở bò');
    expect(
      selected!.ref,
      const RelogDishRef(sourceMealId: 'meal-1', mealItemOrder: 0),
    );
  });

  testWidgets('typing a slash in the real field opens the picker',
      (tester) async {
    // The whole chain, end to end: TextField → controller listener →
    // syncMentions → onSync → token parse. Every other test drives the picker
    // by passing a query in, so this is the only one that proves a keystroke
    // reaches it — and that the controller's own notifyListeners during that
    // dispatch doesn't recurse.
    var picker = const SlashPickerState();
    await tester.pumpWidget(
      _wrap(
        MealInput(
          controller: inputController,
          textController: textController,
          onSubmit: (_) {},
          onSync: () => picker = picker.sync(textController.activeToken),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'sáng nay ăn /pho');
    await tester.pumpAndSettle();

    expect(picker.isOpen, isTrue);
    expect(picker.query, 'pho');

    // …and a slash that does not begin a word never opens it.
    await tester.enterText(find.byType(TextField), 'ăn 1/2 quả');
    await tester.pumpAndSettle();
    expect(picker.isOpen, isFalse);
  });

  testWidgets('no picker while no token is open', (tester) async {
    await tester.pumpWidget(composer());
    await tester.pumpAndSettle();
    expect(find.byType(RelogPickerOption), findsNothing);
  });

  testWidgets('the picker never opens in cheat mode', (tester) async {
    // Relog is normal-mode only: the server REJECTS a cheat submission that
    // carries picks, so the picker must not be reachable there at all.
    await tester.pumpWidget(
      composer(relogQuery: '', mode: MealLogMode.cheat),
    );
    await tester.pumpAndSettle();
    expect(find.byType(RelogPickerOption), findsNothing);
  });

  group('staged picks', () {
    testWidgets('render with their macros and a running total', (tester) async {
      _stage(textController, 'Phở bò');
      await tester.pumpWidget(composer());
      await tester.pumpAndSettle();

      expect(find.byType(RelogStagedList), findsOneWidget);
      expect(find.text('Phở bò'), findsOneWidget);
      expect(find.text('Total'), findsOneWidget);
      expect(find.text('410 kcal'), findsWidgets);
    });

    testWidgets('a staged pick alone arms submit', (tester) async {
      // Nothing is typed beyond the pick's own label, so this is the case that
      // used to leave the send button dead: the picks ARE the meal.
      _stage(textController, 'Phở bò');
      await tester.pumpWidget(composer());
      await tester.pumpAndSettle();

      final send = tester.widget<ComposerActionButton>(
        find.byType(ComposerActionButton),
      );
      expect(send.onTap, isNotNull);
      expect(send.enabled, isTrue);
    });

    testWidgets('an empty composer leaves submit disarmed', (tester) async {
      await tester.pumpWidget(composer());
      await tester.pumpAndSettle();

      final send = tester.widget<ComposerActionButton>(
        find.byType(ComposerActionButton),
      );
      expect(send.enabled, isFalse);
    });

    testWidgets('removing one actually clears the row from the panel',
        (tester) async {
      // Wired the way FeedArea wires it: the remove handler mutates the
      // controller and NOTHING else. The panel is rebuilt from
      // `textController.entries`, so if the composer doesn't listen to the
      // controller the reference is dropped while its row stays on screen —
      // telling the user a dish will be logged when it won't.
      _stage(textController, 'Phở bò');
      await tester.pumpWidget(
        _wrap(
          _StaticHost(
            child: FeedComposer(
              view: _view,
              calorieTarget: 2000,
              errorText: null,
              mode: MealLogMode.normal,
              cheatIntensity: CheatIntensity.medium,
              onCheatIntensityChange: (_) {},
              userId: 'user-1',
              stagingRepeat: false,
              onRepeatCheat: (_) {},
              controller: inputController,
              onSubmit: (_) {},
              onCancel: () {},
              analyzing: false,
              onModePressed: () {},
              onBarcodePressed: () {},
              onHeightChanged: (_) {},
              onDismissNotice: () {},
              noticeDismissed: true,
              textController: textController,
              onSync: () {},
              onRemoveStaged: textController.removeMention,
              relogQuery: null,
              onSelectRelog: (_) {},
              onDismissRelog: () {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(RelogStagedList), findsOneWidget);

      await tester.tap(find.bySemanticsLabel(RegExp('Remove Phở bò')));
      await tester.pumpAndSettle();

      expect(textController.entries, isEmpty, reason: 'the ref must drop');
      expect(
        find.byType(RelogStagedList),
        findsNothing,
        reason: 'the row must go with it',
      );
    });

    testWidgets('removing one reports its stage id', (tester) async {
      _stage(textController, 'Phở bò');
      await tester.pumpWidget(composer());
      await tester.pumpAndSettle();

      await tester.tap(
        find.bySemanticsLabel(RegExp('Remove Phở bò')),
      );
      await tester.pumpAndSettle();
      expect(removed, 'stage-1');
    });

    testWidgets('are hidden in cheat mode, which owns the composer itself',
        (tester) async {
      _stage(textController, 'Phở bò');
      await tester.pumpWidget(composer(mode: MealLogMode.cheat));
      await tester.pumpAndSettle();
      expect(find.byType(RelogStagedList), findsNothing);
    });
  });
}
