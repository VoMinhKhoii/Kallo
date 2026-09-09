import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/logging/logic/feed/view_state.dart';
import 'package:kallo_mobile/features/logging/logic/meal_log_mode.dart';
import 'package:kallo_mobile/features/logging/widgets/composer/feed_composer.dart';
import 'package:kallo_mobile/features/logging/widgets/composer/meal_input.dart';
import 'package:kallo_mobile/features/logging/widgets/relog/mention_text_controller.dart';
import 'package:kallo_mobile/features/logging/widgets/relog/relog_picker_popup.dart';
import 'package:kallo_mobile/models/logging/cheat.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

import '../../../l10n_test_loader.dart';

/// The `/` picker must not cost the user their keyboard, and must not grow out
/// the top of the feed's Stack when it opens under one.
///
/// Both were the same shape of bug: the dock was laid out UNBOUNDED and the
/// composer card changed its position in the tree when the picker arrived.

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
  onDismissRelog: () {},
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
    final popup = tester.getRect(find.byType(RelogPickerPopup));
    expect(
      popup.top,
      greaterThanOrEqualTo(0),
      reason: 'an unbounded dock grew past the Stack and was clipped',
    );
    expect(
      popup.height,
      lessThan(288.0),
      reason: 'there is not room for its full height under a keyboard',
    );
  });
}
