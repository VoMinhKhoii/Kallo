import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/cupertino.dart' show CupertinoPage;
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

/// The pill-nav shell (native pass, 2026-08-31): tab switches preserve
/// branch state, the Log item PUSHES the feed full-screen over the shell,
/// and the "+" opens the Add sheet.
class _CounterPage extends StatefulWidget {
  const _CounterPage({super.key, required this.label});

  final String label;

  @override
  State<_CounterPage> createState() => _CounterPageState();
}

class _CounterPageState extends State<_CounterPage> {
  int count = 0;

  @override
  Widget build(BuildContext context) => Column(
        children: [
          Text('${widget.label}:$count'),
          TextButton(
            onPressed: () => setState(() => count++),
            child: const Text('bump'),
          ),
        ],
      );
}

GoRouter _router() => GoRouter(
      initialLocation: '/dashboard',
      routes: [
        GoRoute(
          path: '/logging',
          pageBuilder: (_, __) => const CupertinoPage<void>(
            child: Scaffold(body: Text('logging-page')),
          ),
        ),
        StatefulShellRoute.indexedStack(
          builder: (_, __, shell) => TabScaffold(navigationShell: shell),
          branches: [
            StatefulShellBranch(routes: [
              GoRoute(
                path: '/dashboard',
                builder: (_, __) =>
                    const _CounterPage(key: ValueKey('dash'), label: 'dash'),
              ),
            ]),
            StatefulShellBranch(routes: [
              GoRoute(
                path: '/nutrition',
                builder: (_, __) => const _CounterPage(
                    key: ValueKey('nutrition'), label: 'nutrition'),
              ),
            ]),
            StatefulShellBranch(routes: [
              GoRoute(
                path: '/circle',
                builder: (_, __) => const _CounterPage(
                    key: ValueKey('circle'), label: 'circle'),
              ),
            ]),
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
          builder: (context) => MaterialApp.router(
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

  testWidgets('tab switch preserves branch state', (tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    // Mutate dashboard state, hop to Nutrition and back: the count survives
    // because the indexed stack keeps the branch alive.
    await tester.tap(find.text('bump'));
    await tester.pump();
    expect(find.text('dash:1'), findsOneWidget);

    await tester.tap(find.text('Nutrition'));
    await tester.pumpAndSettle();
    expect(find.text('nutrition:0'), findsOneWidget);

    await tester.tap(find.text('Today'));
    await tester.pumpAndSettle();
    expect(find.text('dash:1'), findsOneWidget);
  });

  testWidgets('Log item pushes the feed full-screen over the shell',
      (tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    await tester.tap(find.text('Log'));
    await tester.pumpAndSettle();

    expect(find.text('logging-page'), findsOneWidget);
    // Full-screen push: the shell (and its bar) sits covered beneath the
    // route — offstage, not on the logging screen.
    expect(find.byType(PillNavBar), findsNothing);

    // Back returns to the tab the user left (the real screen's chevron
    // calls maybePop; the stub page has no chrome, so pop via the router).
    GoRouter.of(tester.element(find.text('logging-page'))).pop();
    await tester.pumpAndSettle();
    expect(find.text('dash:0'), findsOneWidget);
    expect(find.byType(PillNavBar), findsOneWidget);
  });

  testWidgets('center "+" opens the Add sheet', (tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    await tester.tap(find.bySemanticsLabel('Add'));
    await tester.pumpAndSettle();

    expect(find.text('Log a meal'), findsOneWidget);
    expect(find.text('Log weight'), findsOneWidget);
  });
}
