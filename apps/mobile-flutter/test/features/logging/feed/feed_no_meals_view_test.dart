import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/circle/data/circle_providers.dart';
import 'package:kallo_mobile/features/logging/logic/feed/view_state.dart';
import 'package:kallo_mobile/models/circle.dart';
import 'package:kallo_mobile/features/logging/widgets/feed/feed_no_meals_view.dart';
import 'package:kallo_mobile/shared/widgets/kallo_mark.dart';

import '../../../l10n_test_loader.dart';

const _empty = FeedViewState(
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

/// The empty feed at a fixed viewport height, with the composer dock claiming
/// [dockHeight] at the bottom. A shorter [height] is what a keyboard does: the
/// scaffold resizes the body, so the feed's own viewport is what shrinks.
Widget _view({
  required double height,
  double dockHeight = 120,
}) => ProviderScope(
  overrides: [
    // Never resolves — the name-less prompt is the one on screen, and the test
    // must not reach the network for it.
    myCircleProfileProvider.overrideWith(
      (ref) => Completer<CircleProfile>().future,
    ),
  ],
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
            home: Scaffold(
              body: Center(
                child: SizedBox(
                  height: height,
                  width: 390,
                  child: FeedNoMealsView(
                    view: _empty,
                    dockHeight: dockHeight,
                  ),
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

  /// Where the mark sits, relative to the top of the feed viewport.
  double markCentre(WidgetTester tester) {
    final mark = tester.getCenter(find.byType(KalloMark));
    final viewportTop = tester.getTopLeft(find.byType(FeedNoMealsView)).dy;
    return mark.dy - viewportTop;
  }

  testWidgets('centres the empty state in the space above the dock', (
    tester,
  ) async {
    const height = 600.0;
    const dock = 120.0;
    await tester.pumpWidget(_view(height: height, dockHeight: dock));
    await tester.pumpAndSettle();

    // The dock is an overlay, so the usable band is the viewport minus its
    // height; the mark's own block is centred in that. A scroll view sizes its
    // child to the content, so without a min-height box this lands near the top
    // instead — which is the bug.
    final centre = markCentre(tester);
    expect(centre, lessThan((height - dock) / 2 + 60));
    expect(centre, greaterThan((height - dock) / 2 - 60));
    expect(
      centre,
      greaterThan(height / 4),
      reason: 'a top-aligned empty state would sit in the first quarter',
    );
  });

  testWidgets('rides up as the keyboard shrinks the viewport', (tester) async {
    await tester.pumpWidget(_view(height: 600));
    await tester.pumpAndSettle();
    final resting = markCentre(tester);

    // What the scaffold's resize does when the field takes focus.
    await tester.pumpWidget(_view(height: 340));
    await tester.pumpAndSettle();

    expect(
      markCentre(tester),
      lessThan(resting),
      reason: 'the block must re-centre in the shorter viewport, not stay put',
    );
  });

  testWidgets(
    'a dock that grows pushes the block up over time, not instantly',
    (tester) async {
      await tester.pumpWidget(_view(height: 600, dockHeight: 120));
      await tester.pumpAndSettle();
      final resting = markCentre(tester);

      // Opening the `/` picker roughly triples the dock, and its height is
      // reported post-frame — one discrete jump the animation has to absorb.
      await tester.pumpWidget(_view(height: 600, dockHeight: 400));
      await tester.pump(const Duration(milliseconds: 60));
      final midway = markCentre(tester);
      expect(midway, lessThan(resting), reason: 'it has started moving');

      await tester.pumpAndSettle();
      expect(
        markCentre(tester),
        lessThan(midway),
        reason: 'and it was still moving at 60ms — i.e. it did not teleport',
      );
    },
  );
}
