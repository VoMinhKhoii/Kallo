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
import 'package:nham_mobile/features/logging/widgets/relog/relog_picker_popup.dart';
import 'package:nham_mobile/models/cheat.dart';
import 'package:nham_mobile/models/relog.dart';
import 'package:nham_mobile/theme/nham_colors.dart';

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
      builder:
          (context) => MaterialApp(
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

/// One `FeedComposer` under test. Kept at file level so a test can host it
/// under something that never rebuilds on its own.
FeedComposer _composerFor({
  required MentionTextEditingController textController,
  required MealInputController inputController,
  String? relogQuery,
  MealLogMode mode = MealLogMode.normal,
  ValueChanged<RelogCandidate>? onSelect,
}) => FeedComposer(
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
  relogQuery: relogQuery,
  onSelectRelog: onSelect ?? (_) {},
  onDismissRelog: () {},
);

/// A parent that never rebuilds its child — like FeedArea between setStates.
/// Without it the enclosing pump would refresh the composer for free and hide a
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

  setUp(() {
    textController = MentionTextEditingController();
    inputController = MealInputController();
    selected = null;
  });
  tearDown(() => textController.dispose());

  Widget composer({
    String? relogQuery,
    MealLogMode mode = MealLogMode.normal,
  }) => _wrap(
    _composerFor(
      textController: textController,
      inputController: inputController,
      relogQuery: relogQuery,
      mode: mode,
      onSelect: (c) => selected = c,
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

  testWidgets('typing a slash in the real field opens the picker', (
    tester,
  ) async {
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

  group('palette', () {
    testWidgets('paints the under-logged notice band, not a white sheet', (
      tester,
    ) async {
      await tester.pumpWidget(composer(relogQuery: ''));
      await tester.pumpAndSettle();

      final decorated = tester.widget<Container>(
        find
            .descendant(
              of: find.byType(RelogPickerPopup),
              matching: find.byType(Container),
            )
            .first,
      );
      final decoration = decorated.decoration! as BoxDecoration;
      expect(decoration.color, NhamColors.bandSurface);
      expect(
        decoration.border,
        isNull,
        reason: 'a solid band carries no border, like the notice',
      );
    });

    testWidgets('renders its copy in full white, never a translucent one', (
      tester,
    ) async {
      // Anything less than full white on this band drops under 4.5:1.
      await tester.pumpWidget(composer(relogQuery: ''));
      await tester.pumpAndSettle();

      for (final label in ['Phở bò', 'DISHES', '410 kcal']) {
        expect(
          tester.widget<Text>(find.text(label)).style?.color,
          NhamColors.bandForeground,
          reason: '"$label" is not full white on the band',
        );
      }
    });
  });

  testWidgets('keeps a way out now that the header label is gone', (
    tester,
  ) async {
    // The close button is the ONLY dismissal: the picker is an inline sibling
    // in the dock, so there is no barrier, no PopScope and no tap-outside.
    var dismissed = false;
    await tester.pumpWidget(
      _wrap(
        RelogPickerPopup(
          candidates: const RelogCandidatesResponse(),
          isLoading: false,
          query: '',
          onSelect: (_) {},
          onDismiss: () => dismissed = true,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('LOGGED DISHES AND MEALS'), findsNothing);
    await tester.tap(find.bySemanticsLabel('Close'));
    expect(dismissed, isTrue);
  });

  testWidgets('a failed search says so instead of "nothing logged yet"', (
    tester,
  ) async {
    // Falling through to the empty copy tells someone with a year of meals
    // that they have never logged anything, and hides that a retry would work.
    await tester.pumpWidget(
      _wrap(
        RelogPickerPopup(
          candidates: const RelogCandidatesResponse(),
          isLoading: false,
          hasError: true,
          onRetry: () {},
          query: 'pho',
          onSelect: (_) {},
          onDismiss: () {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text("Couldn't load your dishes"), findsOneWidget);
    expect(find.text('No dishes found'), findsNothing);
    expect(find.text('Nothing logged yet'), findsNothing);
    expect(find.text('Try again'), findsOneWidget);
  });

  testWidgets('an empty history offers no retry — there is nothing to retry', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        RelogPickerPopup(
          candidates: const RelogCandidatesResponse(),
          isLoading: false,
          query: '',
          onSelect: (_) {},
          onDismiss: () {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Nothing logged yet'), findsOneWidget);
    expect(find.text('Try again'), findsNothing);
  });

  testWidgets('no picker while no token is open', (tester) async {
    await tester.pumpWidget(composer());
    await tester.pumpAndSettle();
    expect(find.byType(RelogPickerOption), findsNothing);
  });

  testWidgets('the picker never opens in cheat mode', (tester) async {
    // Relog is normal-mode only: the server REJECTS a cheat submission that
    // carries picks, so the picker must not be reachable there at all.
    await tester.pumpWidget(composer(relogQuery: '', mode: MealLogMode.cheat));
    await tester.pumpAndSettle();
    expect(find.byType(RelogPickerOption), findsNothing);
  });

  group('committed picks', () {
    testWidgets('read as a blue `/label` inside the field and nothing else', (
      tester,
    ) async {
      _stage(textController, 'Phở bò');
      await tester.pumpWidget(composer());
      await tester.pumpAndSettle();

      // No panel, no macro preview: the pick IS the token in the sentence.
      expect(textController.text.trim(), '/Phở bò');
      expect(find.text('Total'), findsNothing);
      expect(find.text('410 kcal'), findsNothing);

      final field = tester.widget<TextField>(find.byType(TextField));
      final span = (tester.widget<EditableText>(
        find.byType(EditableText),
      )).controller.buildTextSpan(
        context: tester.element(find.byType(EditableText)),
        style: field.style,
        withComposing: false,
      );
      final tinted = span.children!.cast<TextSpan>().where(
        (s) => s.style?.color == NhamColors.mention,
      );
      expect(tinted.map((s) => s.text), ['/Phở bò']);
    });

    testWidgets('a pick alone arms submit', (tester) async {
      // Nothing is typed beyond the pick's own label — the picks ARE the meal.
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

    testWidgets('submit arms and disarms as the field changes under it', (
      tester,
    ) async {
      // The dock does NOT listen to the controller — the field owns that. Host
      // it under something that never rebuilds on its own, so an arming that
      // survives here survived on the field's own notification.
      await tester.pumpWidget(
        _wrap(
          _StaticHost(
            child: _composerFor(
              textController: textController,
              inputController: inputController,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      ComposerActionButton send() => tester.widget<ComposerActionButton>(
        find.byType(ComposerActionButton),
      );
      expect(send().enabled, isFalse);

      await tester.enterText(find.byType(TextField), 'phở bò');
      await tester.pumpAndSettle();
      expect(send().enabled, isTrue);

      await tester.enterText(find.byType(TextField), '');
      await tester.pumpAndSettle();
      expect(send().enabled, isFalse);
    });

    testWidgets('editing the label drops the reference AND its tint', (
      tester,
    ) async {
      // Removal is now just editing: breaking the label is the only way to
      // un-pick, so the tint and the reference must go together. Hosted under a
      // widget that never rebuilds on its own, so anything that stays on screen
      // stayed because the composer failed to notice.
      _stage(textController, 'Phở bò');
      await tester.pumpWidget(
        _wrap(
          _StaticHost(
            child: _composerFor(
              textController: textController,
              inputController: inputController,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(textController.mentions, hasLength(1));

      await tester.enterText(find.byType(TextField), 'phở gà');
      await tester.pumpAndSettle();

      expect(textController.entries, isEmpty, reason: 'the ref must drop');
      final span = (tester.widget<EditableText>(
        find.byType(EditableText),
      )).controller.buildTextSpan(
        context: tester.element(find.byType(EditableText)),
        style: const TextStyle(),
        withComposing: false,
      );
      expect(
        span.toPlainText(),
        'phở gà',
        reason: 'the tinted run must go with the reference',
      );
      expect(
        span.children,
        isNull,
        reason: 'no mentions left means the plain default span',
      );
    });
  });
}
