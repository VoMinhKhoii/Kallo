import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:kallo_mobile/features/circle/data/circle_providers.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_providers.dart';
import 'package:kallo_mobile/shared/widgets/feedback/kallo_refresh.dart';
import 'package:kallo_mobile/shell/nav/pill_nav_bar.dart';
import 'package:kallo_mobile/shell/tab_scaffold.dart';

import '../l10n_test_loader.dart';

/// A branch screen's bottom scroll inset is the pill nav's MEASURED height,
/// which Flutter already reports through `MediaQuery.padding.bottom` under
/// `extendBody`. The hand-written `kNavClearance = 120` duplicated that number
/// and was wrong on every device: the bar lays out 12 + 72 + max(home
/// indicator, 24) — 118 with an indicator, 108 without.
Widget _branch() => KalloRefreshableScroll(
  onRefresh: () async {},
  slivers: (bottomInset) => [
    SliverPadding(
      padding: EdgeInsets.only(bottom: bottomInset),
      sliver: SliverList(
        delegate: SliverChildListDelegate([
          const SizedBox(height: 2000, child: Text('branch-body')),
        ]),
      ),
    ),
  ],
);

GoRouter _router() => GoRouter(
  initialLocation: '/dashboard',
  routes: [
    StatefulShellRoute.indexedStack(
      builder: (_, _, shell) => TabScaffold(navigationShell: shell),
      branches: [
        StatefulShellBranch(
          routes: [GoRoute(path: '/dashboard', builder: (_, _) => _branch())],
        ),
      ],
    ),
  ],
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

  testWidgets('a branch scroll clears the pill nav by its measured height', (
    tester,
  ) async {
    final router = _router();
    addTearDown(router.dispose);
    await tester.pumpWidget(
      ProviderScope(
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
      ),
    );
    await tester.pumpAndSettle();

    final navHeight = tester.getSize(find.byType(PillNavBar)).height;
    final padding =
        tester.widget<SliverPadding>(find.byType(SliverPadding)).padding
            as EdgeInsets;

    expect(
      padding.bottom,
      navHeight,
      reason:
          'the scroll must reserve exactly what the bar measures, not a '
          'hand-copied constant',
    );
  });
}
