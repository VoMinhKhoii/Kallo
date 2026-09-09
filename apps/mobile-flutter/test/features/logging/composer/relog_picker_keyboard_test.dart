import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/logic/feed/view_state.dart';
import 'package:kallo_mobile/features/logging/logic/meal_log_mode.dart';
import 'package:kallo_mobile/features/logging/widgets/composer/composer_action_row.dart';
import 'package:kallo_mobile/features/logging/widgets/composer/feed_composer.dart';
import 'package:kallo_mobile/features/logging/widgets/composer/meal_input.dart';
import 'package:kallo_mobile/features/logging/widgets/relog/mention_text_controller.dart';
import 'package:kallo_mobile/features/logging/widgets/relog/relog_picker_popup.dart';
import 'package:kallo_mobile/models/logging/cheat.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

import '../../../l10n_test_loader.dart';

/// The `/` picker must not cost the user their keyboard, must not grow out the
/// top of the feed's Stack when it opens under one, and must not push the
/// composer's own controls down under the keyboard.
///
/// The first two were the same shape of bug: the dock was laid out UNBOUNDED
/// and the composer card changed its position in the tree when the picker
/// arrived. The third is its mirror — everything in the dock could shrink
/// except the card, which then overflowed out of the bottom instead.

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
    },
  ],
  'meals': <Map<String, Object?>>[],
};

const _view = FeedViewState(
  date: '2026-01-01',
  persistedMeals: [],
  pendingConfirmations: [],
  entries: [],
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
  hasLiveTail: false,
  showPartialDayNotice: false,
);

/// The feed's Stack, so a test can measure what the dock is allowed to fill.
const stackKey = 'feed-stack';

/// The feed's own geometry: a bounded Stack with the composer filled into it,
/// under a keyboard. [Positioned.fill] is the production wiring — see
/// `feed_area.dart`.
Widget _wrap(Widget child, {double height = 500, double keyboard = 300}) =>
    ProviderScope(
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
            home: Builder(
              builder: (context) => MediaQuery(
                data: MediaQuery.of(
                  context,
                ).copyWith(viewInsets: EdgeInsets.only(bottom: keyboard)),
                child: Align(
                  alignment: Alignment.topLeft,
                  child: SizedBox(
                    height: height,
                    width: 390,
                    // The feed's Stack, and a Material for the TextField.
                    child: Material(
                      child: Stack(
                        key: const ValueKey(stackKey),
                        children: [Positioned.fill(child: child)],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );

FeedComposer _composer({
  required MentionTextEditingController textController,
  required MealInputController inputController,
  String? relogQuery,
  VoidCallback? onDismissRelog,
}) => FeedComposer(
  view: _view,
  calorieTarget: 2000,
  errorText: null,
  mode: MealLogMode.normal,
  cheatIntensity: CheatIntensity.medium,
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
  onSelectRelog: (_) {},
  onDismissRelog: onDismissRelog ?? () {},
);

/// Hosts one composer whose picker can be opened without rebuilding anything
/// above it — the production path, where a keystroke opens the picker and
/// nothing else about the dock changes.
class _Host extends StatefulWidget {
  const _Host({required this.textController, required this.inputController});

  final MentionTextEditingController textController;
  final MealInputController inputController;

  @override
  State<_Host> createState() => _HostState();
}

class _HostState extends State<_Host> {
  String? query;

  void open(String value) => setState(() => query = value);

  @override
  Widget build(BuildContext context) => _composer(
    textController: widget.textController,
    inputController: widget.inputController,
    relogQuery: query,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpL10nBinding();

  late MentionTextEditingController textController;
  late MealInputController inputController;

  setUp(() {
    textController = MentionTextEditingController();
    inputController = MealInputController();
  });

  tearDown(() => textController.dispose());

  testWidgets('opening the picker keeps the keyboard and the field alive', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(
        _Host(
          textController: textController,
          inputController: inputController,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byType(TextField));
    await tester.pumpAndSettle();
    expect(
      tester.testTextInput.isVisible,
      isTrue,
      reason: 'the field is focused, so the keyboard is up',
    );
    final before = tester.state(find.byType(EditableText));

    tester.state<_HostState>(find.byType(_Host)).open('ph');
    await tester.pumpAndSettle();

    expect(find.byType(RelogPickerPopup), findsOneWidget);
    expect(
      identical(tester.state(find.byType(EditableText)), before),
      isTrue,
      reason:
          'the card kept its slot, so the field was updated in place rather '
          'than re-inflated',
    );
    expect(
      tester.testTextInput.isVisible,
      isTrue,
      reason: 're-inflating the field closes its input connection for good',
    );
  });

  testWidgets('the picker shrinks to fit rather than growing off the top', (
    tester,
  ) async {
    // Room for a usable picker, but not for its full 288.
    await tester.pumpWidget(
      _wrap(
        _composer(
          textController: textController,
          inputController: inputController,
          relogQuery: 'ph',
        ),
        height: 700,
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    final popup = tester.getRect(find.byType(RelogPickerPopup));
    expect(
      popup.top,
      greaterThanOrEqualTo(0),
      reason: 'an unbounded dock grew past the Stack and was clipped',
    );
    expect(
      popup.height,
      greaterThan(0),
      reason: 'there is room here, so the picker must actually be shown',
    );
    expect(
      popup.height,
      lessThanOrEqualTo(288.0),
      reason: 'there is not room for its full height under a keyboard',
    );
  });

  testWidgets('gives its room back when a row would not fit', (tester) async {
    // 500 - 300 leaves a 200pt dock. The card needs all of it for an eight-line
    // message, so the close row (44) and the bottom gap (12) alone do not fit
    // in what is left: a rendered picker would be a useless strip that shortens
    // the field. Two loose Flexibles split the dock in half up front instead
    // and left the field 26pt.
    textController.text = '${'a\n' * 7}a';
    await tester.pumpWidget(
      _wrap(
        _composer(
          textController: textController,
          inputController: inputController,
          relogQuery: 'ph',
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.byType(RelogPickerPopup), findsOneWidget);
    expect(
      tester.getRect(find.byType(RelogPickerPopup)).height,
      0,
      reason: 'below _minUsableHeight the popup collapses to nothing',
    );
    expect(
      tester.getRect(find.byType(TextField)).height,
      greaterThanOrEqualTo(100),
      reason: 'the room the picker gave up must reach the FIELD',
    );
  });

  testWidgets('a collapsed picker dismisses itself, exactly once', (
    tester,
  ) async {
    // Rendering nothing is not closing: `relogQuery` stayed live, so every
    // keystroke still ran a search whose results could never be seen, and the
    // slot stayed allocated.
    var dismissals = 0;
    textController.text = '${'a\n' * 7}a';
    await tester.pumpWidget(
      _wrap(
        _composer(
          textController: textController,
          inputController: inputController,
          relogQuery: 'ph',
          onDismissRelog: () => dismissals++,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(dismissals, 1, reason: 'the collapsed picker hands the token back');

    // A build can run several times per frame, and the popup rebuilds on every
    // keystroke — the dismissal must not repeat itself.
    await tester.pump();
    await tester.pumpAndSettle();
    expect(dismissals, 1);
  });

  testWidgets('a bounded dock feeds the card first, then the picker', (
    tester,
  ) async {
    // 720 - 300 is a 420pt dock: room for the card (250 with an eight-line
    // message) AND a usable picker in what is left. Two loose Flexibles handed
    // each of them HALF of it up front, so the card was cut to 210 and its
    // field to 136 while the picker sat on room it did not need.
    //
    // The default test surface is 800x600, which would clip the dock before it
    // ever saw the 720.
    await tester.binding.setSurfaceSize(const Size(400, 800));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    textController.text = '${'a\n' * 7}a';
    await tester.pumpWidget(
      _wrap(
        _composer(
          textController: textController,
          inputController: inputController,
          relogQuery: 'ph',
        ),
        height: 720,
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(
      tester.getRect(find.byType(TextField)).height,
      greaterThanOrEqualTo(190),
      reason: 'the card is laid out before the flex is divided, so it takes '
          'the height it needs',
    );
    expect(
      tester.getRect(find.byType(RelogPickerPopup)).height,
      greaterThan(0),
      reason: 'and there is plenty left over for the picker',
    );
  });

  testWidgets('a tall message shrinks the FIELD, never the action row', (
    tester,
  ) async {
    // Eight lines, no picker: the card alone (~294pt) is taller than the dock's
    // whole budget (500 − 300). Unbounded, it overflowed DOWN into the keyboard
    // and took mode/scan/send with it.
    textController.text = '${'a\n' * 7}a';
    await tester.pumpWidget(
      _wrap(
        _composer(
          textController: textController,
          inputController: inputController,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    final stack = tester.getRect(find.byKey(const ValueKey(stackKey)));
    final row = tester.getRect(find.byType(ComposerActionRow));
    expect(
      row.bottom,
      lessThanOrEqualTo(stack.bottom),
      reason: 'the send button is under the keyboard and cannot be reached',
    );
  });
}
