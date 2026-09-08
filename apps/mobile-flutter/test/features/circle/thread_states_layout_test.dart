import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/circle/data/thread_providers.dart';
import 'package:kallo_mobile/features/circle/widgets/states/circle_error.dart';
import 'package:kallo_mobile/features/circle/widgets/states/circle_skeleton.dart';
import 'package:kallo_mobile/features/circle/widgets/thread/thread_states.dart';
import 'package:kallo_mobile/shared/widgets/feedback/kallo_surface_state.dart';
import 'package:kallo_mobile/shared/widgets/brand/surface_illustration.dart';
import 'package:kallo_mobile/shared/widgets/surface/kallo_primitives.dart';
import 'package:kallo_mobile/theme/kallo_theme.dart';

import '../../l10n_test_loader.dart';

/// Where the thread's not-ready surfaces sit on the page.
///
/// A card that hugs the top of an otherwise empty page reads as content that
/// failed to finish loading. Failed and gone are the whole page, so they sit
/// at the middle of it; the skeleton is the exception and stays top-anchored,
/// because it is a preview of where the real card will land.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const viewport = Size(390, 700);

  setUpAll(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/shared_preferences'),
          (call) async => call.method == 'getAll' ? <String, Object>{} : null,
        );
    await EasyLocalization.ensureInitialized();
  });

  /// [settle] is off for the skeleton: its shimmer never stops, so
  /// `pumpAndSettle` would time out on it.
  Future<void> pumpStates(
    WidgetTester tester,
    ThreadView view, {
    bool settle = true,
    Size size = viewport,
    TextScaler textScaler = TextScaler.noScaling,
  }) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = size;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      EasyLocalization(
        supportedLocales: const [Locale('en')],
        path: 'assets/l10n',
        fallbackLocale: const Locale('en'),
        assetLoader: const FsL10nLoader(),
        child: Builder(
          builder:
              (context) => MaterialApp(
                localizationsDelegates: context.localizationDelegates,
                supportedLocales: context.supportedLocales,
                locale: context.locale,
                // `SizedBox.expand`, because the page these states land on hands
                // them a TIGHT height (ScrollSeparator's `Expanded`). A bare
                // Scaffold body is loose, and a scroll view would shrink-wrap to
                // its content — hiding exactly the layout under test.
                home: Scaffold(
                  body: SizedBox.expand(
                    child: ThreadStates(view: view, onRetry: () {}),
                  ),
                ),
              ),
        ),
      ),
    );
    // The illustrations decode off the main isolate: the surface only takes
    // its real height once actual async work has run.
    await tester.runAsync(() async {
      await Future<void>.delayed(const Duration(milliseconds: 100));
    });
    if (settle) {
      await tester.pumpAndSettle();
    } else {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  /// The state's own content — illustration through action — against the
  /// middle of the page it owns, and the state's BOX against the same middle.
  ///
  /// Both, because they are two different claims: the content extremes say the
  /// state reads as centred, and the box says [KalloSurfaceState] hugs its
  /// content under the fill sliver's `Center` instead of filling the region —
  /// which is what lets a host that draws a card around it draw a card.
  void expectCentred(WidgetTester tester) {
    final page = tester.getRect(find.byType(ThreadStates));
    final top = tester.getRect(find.byType(SurfaceIllustration)).top;
    final bottom = tester.getRect(find.byType(KalloButton)).bottom;
    expect(page.height, moreOrLessEquals(700, epsilon: 1));
    expect((top + bottom) / 2, moreOrLessEquals(page.center.dy, epsilon: 1));
    // The box itself: the page insets are the same top and bottom, so the
    // region's middle is the page's middle.
    final region = page.height - KalloSpacing.sp3 * 2;
    final box = tester.getRect(find.byType(KalloSurfaceState));
    expect(box.center.dy, moreOrLessEquals(page.center.dy, epsilon: 1));
    expect(
      box.height,
      lessThan(region - 50),
      reason: 'the state must hug its content, not fill the region',
    );
    // Real air above it: a state pinned under the top inset with half the
    // page empty beneath reads as content that never finished loading.
    expect(
      top - page.top,
      greaterThan(KalloSpacing.sp3 * 2),
      reason: 'the state must not hug the top of an otherwise empty page',
    );
  }

  testWidgets('the failed card sits in the middle of the page', (tester) async {
    await pumpStates(tester, const ThreadFailed());
    expect(find.byType(CircleErrorCard), findsOneWidget);
    expectCentred(tester);
  });

  testWidgets('the gone state sits in the middle of the page', (tester) async {
    await pumpStates(tester, const ThreadMissing());
    expect(find.text("This post isn't here any more"), findsOneWidget);
    expectCentred(tester);
  });

  testWidgets('the loading skeleton stays top-anchored', (tester) async {
    await pumpStates(tester, const ThreadLoading(), settle: false);
    final page = tester.getRect(find.byType(ThreadStates));
    // Exactly the page inset below the top: the skeleton previews where the
    // real card lands, so it must not drift to the middle with the states.
    expect(
      tester.getRect(find.byType(CircleWallSkeleton)).top,
      moreOrLessEquals(page.top + KalloSpacing.sp3, epsilon: 1),
    );
  });

  testWidgets('the smallest phone at 1.3x still fits, and scrolls if it must', (
    tester,
  ) async {
    // A centred state is a fill sliver: if the card outgrows the space it must
    // extend the sliver and scroll, never paint over its own bounds.
    await pumpStates(
      tester,
      const ThreadFailed(),
      size: const Size(320, 640),
      textScaler: const TextScaler.linear(1.3),
    );
    expect(tester.takeException(), isNull);
  });
}
