import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:kallo_mobile/features/circle/data/circle_providers.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_providers.dart';
import 'package:kallo_mobile/shell/sidebar/sidebar.dart';
import 'package:kallo_mobile/shell/tab_scaffold.dart';

import '../l10n_test_loader.dart';

/// A branch page shaped like the real ones: mostly plain canvas, with one band
/// that owns horizontal drags of its own (the dashboard's day pager, the
/// logging week strip).
class _Page extends StatelessWidget {
  const _Page();

  @override
  Widget build(BuildContext context) => Column(
    children: [
      const Expanded(
        child: ColoredBox(
          color: Color(0xFF00AA88),
          child: SizedBox.expand(child: Text('plain')),
        ),
      ),
      const SizedBox(
        height: 80,
        child: Dismissible(
          key: ValueKey('dismiss'),
          direction: DismissDirection.endToStart,
          background: ColoredBox(color: Color(0xFFCC3333)),
          child: ColoredBox(
            key: ValueKey('card'),
            color: Color(0xFF778899),
            child: SizedBox.expand(),
          ),
        ),
      ),
      SizedBox(
        key: const ValueKey('pager'),
        height: 160,
        // Three pages, not one: a PageView with nothing to scroll to
        // registers no drag recognizer at all, so it would not stand in for
        // the real day pager.
        child: PageView(
          children: const [
            ColoredBox(color: Color(0xFF334455)),
            ColoredBox(color: Color(0xFF445566)),
            ColoredBox(color: Color(0xFF556677)),
          ],
        ),
      ),
    ],
  );
}

GoRouter _router() => GoRouter(
  initialLocation: '/logging',
  routes: [
    StatefulShellRoute.indexedStack(
      builder: (_, _, shell) => TabScaffold(navigationShell: shell),
      branches: [
        StatefulShellBranch(
          routes: [GoRoute(path: '/logging', builder: (_, _) => const _Page())],
        ),
      ],
    ),
  ],
);

Widget _app() => ProviderScope(
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
      builder:
          (context) => MaterialApp.router(
            localizationsDelegates: context.localizationDelegates,
            supportedLocales: context.supportedLocales,
            locale: context.locale,
            routerConfig: _router(),
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

  /// True once the panel has travelled in from off-screen. Read off the
  /// rendered position rather than the controller, so the assertion is about
  /// what the user sees.
  bool drawerIsOpen(WidgetTester tester) {
    final panel = find.byType(Sidebar);
    if (panel.evaluate().isEmpty) return false;
    return tester.getTopLeft(panel).dx > -1;
  }

  /// A stepped drag, because a one-shot `dragFrom` is not a finger: when two
  /// recognizers contest the arena the winning one spends that single move
  /// resolving, and no update is ever delivered.
  Future<void> swipe(WidgetTester tester, Offset from, double dx) async {
    final drag = await tester.startGesture(from);
    for (var i = 0; i < 12; i++) {
      await drag.moveBy(Offset(dx / 12, 0));
      await tester.pump(const Duration(milliseconds: 16));
    }
    await drag.up();
    await tester.pumpAndSettle();
  }

  testWidgets('a swipe from the middle of the page opens the drawer', (
    tester,
  ) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();
    expect(drawerIsOpen(tester), isFalse);

    // The complaint: this used to do nothing at all unless the finger landed
    // in the leftmost 20px.
    await swipe(tester, tester.getCenter(find.text('plain')), 240);

    expect(drawerIsOpen(tester), isTrue);
  });

  testWidgets('page content that owns horizontal drags still wins them', (
    tester,
  ) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    // The detector wraps the shell instead of covering it, so the pager —
    // deeper in the hit-test path — takes the arena first.
    await swipe(tester, tester.getCenter(find.byKey(const ValueKey('pager'))), 240);

    expect(drawerIsOpen(tester), isFalse);
  });

  testWidgets('the left edge claims the drag back over such content', (
    tester,
  ) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    // The 20px strip sits ON TOP of the page, so the drawer is never
    // unreachable from a surface that swallows the wider gesture.
    final pager = tester.getCenter(find.byKey(const ValueKey('pager')));
    await swipe(tester, Offset(8, pager.dy), 240);

    expect(drawerIsOpen(tester), isTrue);
  });

  testWidgets('a meal card keeps the drag, so the edge is the way in', (
    tester,
  ) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    // The documented cost of letting content win: a Dismissible claims the
    // arena on ANY horizontal drag, not only the way it dismisses, so a
    // rightward swipe on a card does nothing...
    final card = tester.getCenter(find.byKey(const ValueKey('card')));
    await swipe(tester, card, 240);
    expect(drawerIsOpen(tester), isFalse);

    // ...which is exactly what the edge strip exists to cover.
    await swipe(tester, Offset(8, card.dy), 240);
    expect(drawerIsOpen(tester), isTrue);
  });

  testWidgets('a leftward swipe on a card still dismisses it', (
    tester,
  ) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    final card = find.byKey(const ValueKey('card'));
    final restingLeft = tester.getTopLeft(card).dx;

    final drag = await tester.startGesture(tester.getCenter(card));
    for (var i = 0; i < 12; i++) {
      await drag.moveBy(const Offset(-10, 0));
      await tester.pump(const Duration(milliseconds: 16));
    }

    // The card itself is travelling, which is only possible if its own
    // Dismissible took the drag rather than the drawer's detector.
    expect(tester.getTopLeft(card).dx, lessThan(restingLeft - 50));
    expect(drawerIsOpen(tester), isFalse);

    await drag.up();
    await tester.pumpAndSettle();
  });

  testWidgets('a leftward swipe on a closed drawer leaves it closed', (
    tester,
  ) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    // A drawer inching out under a leftward flick would read as a glitch.
    await swipe(tester, tester.getCenter(find.text('plain')), -240);

    expect(drawerIsOpen(tester), isFalse);
  });

  testWidgets('the hamburger still opens it', (tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    NavDrawerScope.maybeOf(
      tester.element(find.byType(_Page)),
    )!.open();
    await tester.pumpAndSettle();

    expect(drawerIsOpen(tester), isTrue);
  });
}
