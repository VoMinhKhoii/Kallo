import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:kallo_mobile/features/circle/data/circle_providers.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_providers.dart';
import 'package:kallo_mobile/shell/nav/pill_nav_bar.dart';
import 'package:kallo_mobile/shell/tab_scaffold.dart';

import '../l10n_test_loader.dart';

/// Reading DOWN a branch slides the pill nav off the bottom edge; the first
/// upward flick brings it back.
///
/// The bar must TRANSLATE, never resize: its laid-out height is what
/// `extendBody` republishes as every branch's `MediaQuery.padding.bottom`
/// (pinned by `nav_clearance_test`), so shrinking it mid-scroll would yank
/// the inset out from under the content the user is reading.
Widget _scroller(double height, Key key) => ListView(
  key: key,
  children: [SizedBox(height: height, child: const Text('body'))],
);

GoRouter _router() => GoRouter(
  initialLocation: '/dashboard',
  routes: [
    StatefulShellRoute.indexedStack(
      builder: (_, _, shell) => TabScaffold(navigationShell: shell),
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/dashboard',
              builder: (_, _) => _scroller(2000, const ValueKey('long')),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/nutrition',
              builder: (_, _) => _scroller(550, const ValueKey('short')),
            ),
          ],
        ),
      ],
    ),
  ],
);

Widget _app(GoRouter router) => ProviderScope(
  overrides: [
    onboardingResumeProvider.overrideWithValue(false),
    mealShareInvitesProvider.overrideWith((_) async => const []),
  ],
  child: EasyLocalization(
    supportedLocales: const [Locale('en')],
    path: 'assets/l10n',
    fallbackLocale: const Locale('en'),
    assetLoader: const FsL10nLoader(),
    child: Builder(
      builder: (context) => MaterialApp.router(
        localizationsDelegates: context.localizationDelegates,
        supportedLocales: context.supportedLocales,
        locale: context.locale,
        routerConfig: router,
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

  Future<GoRouter> pump(WidgetTester tester) async {
    final router = _router();
    addTearDown(router.dispose);
    await tester.pumpWidget(_app(router));
    await tester.pumpAndSettle();
    return router;
  }

  /// The pill's own rect. `PillNavBar` is the bottomNavigationBar SLOT, whose
  /// height never changes; the capsule inside it is what travels.
  Rect pill(WidgetTester tester) => tester.getRect(
    find.descendant(
      of: find.byType(PillNavBar),
      matching: find.byType(Container),
    ).first,
  );

  testWidgets('scrolling down hides the bar and scrolling up reveals it', (
    tester,
  ) async {
    await pump(tester);
    final screen = tester.getSize(find.byType(MaterialApp)).height;
    final slotHeight = tester.getSize(find.byType(PillNavBar)).height;
    expect(pill(tester).bottom, lessThanOrEqualTo(screen));

    // Drag up = read down the page.
    await tester.drag(find.byKey(const ValueKey('long')), const Offset(0, -400));
    await tester.pumpAndSettle();
    expect(
      pill(tester).top,
      greaterThanOrEqualTo(screen),
      reason: 'the capsule must be translated fully off the bottom edge',
    );
    expect(
      tester.getSize(find.byType(PillNavBar)).height,
      slotHeight,
      reason: 'hiding must translate the bar, never resize the nav slot — '
          'that height is every branch body’s bottom inset',
    );

    // Drag down = back up the page (a pull-to-refresh overscroll reads the
    // same `forward` direction, so it reveals too).
    await tester.drag(find.byKey(const ValueKey('long')), const Offset(0, 200));
    await tester.pumpAndSettle();
    expect(pill(tester).bottom, lessThanOrEqualTo(screen));
    expect(pill(tester).top, lessThan(screen));
  });

  testWidgets('a page barely taller than the viewport never hides the bar', (
    tester,
  ) async {
    await pump(tester);
    final screen = tester.getSize(find.byType(MaterialApp)).height;

    await tester.tap(find.bySemanticsLabel('Nutrition'));
    await tester.pumpAndSettle();

    await tester.drag(
      find.byKey(const ValueKey('short')),
      const Offset(0, -400),
    );
    await tester.pumpAndSettle();
    expect(
      pill(tester).top,
      lessThan(screen),
      reason: 'a short page has no travel to earn the bar back with',
    );
  });

  testWidgets('switching branch reveals a hidden bar', (tester) async {
    await pump(tester);
    final screen = tester.getSize(find.byType(MaterialApp)).height;

    await tester.drag(find.byKey(const ValueKey('long')), const Offset(0, -400));
    await tester.pumpAndSettle();
    expect(pill(tester).top, greaterThanOrEqualTo(screen));

    // The bar is translated off-screen, so neither a hit-tested tap nor the
    // semantics tree (which culls it) can reach the tab — invoke the handler
    // the pill would. This is the reveal-on-branch-switch rule itself: a tab
    // switch always brings the bar back, whatever hid it.
    tester
        .widget<GestureDetector>(
          find.descendant(
            of: find.bySemanticsLabel('Nutrition'),
            matching: find.byType(GestureDetector),
          ),
        )
        .onTap!();
    await tester.pumpAndSettle();
    expect(pill(tester).top, lessThan(screen));
  });
}
