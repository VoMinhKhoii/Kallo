import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/circle/data/circle_providers.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_providers.dart';
import 'package:kallo_mobile/shell/sidebar/nav_drawer.dart';
import 'package:kallo_mobile/shell/sidebar/sidebar.dart';
import 'package:kallo_mobile/theme/kallo_motion.dart';

import '../l10n_test_loader.dart';

/// Hosts the drawer over a body, driving it from a controller the test owns.
class _Host extends StatefulWidget {
  const _Host({required this.mounted});

  final bool mounted;

  @override
  State<_Host> createState() => _HostState();
}

class _HostState extends State<_Host> with SingleTickerProviderStateMixin {
  late final AnimationController controller = AnimationController(
    vsync: this,
    duration: KalloMotion.drawerOpen,
    reverseDuration: KalloMotion.drawerClose,
  );

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Stack(
    children: [
      const Positioned.fill(child: ColoredBox(color: Color(0xFF00AA88))),
      NavDrawer(
        controller: controller,
        mounted: widget.mounted,
        onClose: controller.reverse,
      ),
    ],
  );
}

/// SidebarNavList reads GoRouterState to mark the active row, so the drawer can
/// only be pumped under a real router.
GoRouter _router({required bool mounted}) => GoRouter(
  initialLocation: '/logging',
  routes: [
    GoRoute(
      path: '/logging',
      builder: (_, _) => Scaffold(body: _Host(mounted: mounted)),
    ),
  ],
);

Widget _app({bool mounted = true}) => ProviderScope(
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
            routerConfig: _router(mounted: mounted),
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

  AnimationController controllerOf(WidgetTester tester) =>
      (tester.state(find.byType(_Host)) as _HostState).controller;

  testWidgets('builds nothing until the drawer has been opened once', (
    tester,
  ) async {
    await tester.pumpWidget(_app(mounted: false));
    await tester.pumpAndSettle();

    expect(find.byType(Sidebar), findsNothing);
  });

  testWidgets('travels from fully off-screen to flush with the edge', (
    tester,
  ) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    final width = tester.getSize(find.byType(Sidebar)).width;
    expect(
      tester.getTopLeft(find.byType(Sidebar)).dx,
      closeTo(-width, 0.5),
      reason: 'closed, the panel sits entirely off the left edge',
    );

    controllerOf(tester).forward();
    await tester.pumpAndSettle();

    expect(tester.getTopLeft(find.byType(Sidebar)).dx, closeTo(0, 0.5));
  });

  testWidgets('slides without rebuilding the sidebar each frame', (
    tester,
  ) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();
    final element = tester.element(find.byType(Sidebar));

    controllerOf(tester).forward();
    // Walk through the middle of the animation, where a builder-owned subtree
    // would be re-created on every one of these frames.
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 40));
    }
    await tester.pumpAndSettle();

    // Same element throughout: the sidebar was built once and carried, not
    // rebuilt ~30 times with its two provider reads and its SVG wordmark.
    expect(identical(tester.element(find.byType(Sidebar)), element), isTrue);
  });

  testWidgets('the closed scrim does not swallow taps meant for the app', (
    tester,
  ) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    final scrim = tester.widgetList<IgnorePointer>(
      find.descendant(
        of: find.byType(NavDrawer),
        matching: find.byType(IgnorePointer),
      ),
    );
    expect(scrim.any((w) => w.ignoring), isTrue);

    controllerOf(tester).forward();
    await tester.pumpAndSettle();

    final open = tester.widgetList<IgnorePointer>(
      find.descendant(
        of: find.byType(NavDrawer),
        matching: find.byType(IgnorePointer),
      ),
    );
    expect(open.every((w) => !w.ignoring), isTrue);
  });
}
