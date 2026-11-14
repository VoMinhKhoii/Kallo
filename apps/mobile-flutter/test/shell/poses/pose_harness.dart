import 'dart:async';
import 'dart:math';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/router.dart';
import 'package:kallo_mobile/features/dashboard/data/dashboard_cache.dart';
import 'package:kallo_mobile/features/circle/data/circle_providers.dart';
import 'package:kallo_mobile/models/social/circle.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_draft_providers.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/services/http/api_client.dart';
import 'package:kallo_mobile/shell/kallo_app_theme.dart';
import 'package:kallo_mobile/shared/widgets/mascot/bun_mascot.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../app_fonts.dart';
import '../../l10n_test_loader.dart';
import 'fixture_api.dart';
import 'fixtures.dart';
import 'poses.dart';

final _session = Session(
  accessToken: 'synthetic-pose-token',
  tokenType: 'bearer',
  user: const User(
    id: 'pose-viewer',
    appMetadata: {},
    userMetadata: {},
    aud: 'authenticated',
    email: 'alex@example.invalid',
    createdAt: '2026-01-01T00:00:00Z',
    lastSignInAt: '2026-11-01T00:00:00Z',
  ),
);

/// No disk reads/writes or cache state shared between matrix cases.
class _MemoryDashboardCache extends DashboardCache {
  @override
  Future<Map<String, dynamic>?> takeOnce(
    String userId,
    String date,
    int tz,
  ) async => null;

  @override
  Future<void> save(
    String userId,
    String date,
    int tz,
    Map<String, dynamic> bundle,
  ) async {}
}

Future<void> initializePoseHarness() async {
  final messenger =
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
  messenger.setMockMethodCallHandler(
    const MethodChannel('plugins.flutter.io/shared_preferences'),
    (call) async => call.method == 'getAll' ? <String, Object>{} : null,
  );
  messenger.setMockMethodCallHandler(
    const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
    (_) async => null,
  );
  await EasyLocalization.ensureInitialized();
  await loadAppFonts();
  await loadIconFonts();
  final activeIcons = FontLoader('packages/lucide_icons_flutter/Lucide400');
  activeIcons.addFont(
    rootBundle.load(
      'packages/lucide_icons_flutter/assets/build_font/LucideVariable-w400.ttf',
    ),
  );
  await activeIcons.load();
}

/// Production router + theme + shell; omits KalloApp's native lifecycle,
/// notification and launch-curtain integrations, which are not layout subjects.
Future<Future<void> Function()> bootPose(
  WidgetTester tester,
  Pose pose,
  String route, {
  bool signedIn = true,
  double textScale = 1,
}) async {
  final dpr = pose.devicePixelRatio;
  BunMascot.debugRandom = Random(0);
  addTearDown(() => BunMascot.debugRandom = null);
  tester.view.devicePixelRatio = dpr;
  tester.view.physicalSize = pose.size * dpr;
  final padding = FakeViewPadding(
    left: pose.padding.left * dpr,
    top: pose.padding.top * dpr,
    right: pose.padding.right * dpr,
    bottom: pose.padding.bottom * dpr,
  );
  tester.view.padding = padding;
  tester.view.viewPadding = padding;
  addTearDown(tester.view.reset);

  final fixtures = PoseFixtures();
  final api = fixtureApi(fixtures);
  final errors = _ProviderErrors();
  final container = ProviderContainer(
    observers: [errors],
    overrides: [
      apiClientProvider.overrideWithValue(api),
      dashboardCacheProvider.overrideWithValue(_MemoryDashboardCache()),
      // The ambient badge stream polls forever; retain the real paged feed,
      // but supply a finite badge snapshot so disposal cannot await a tick.
      circleFeedProvider.overrideWith(
        (_) =>
            Stream.value(fixtures.posts.map(CircleFeedEntry.fromJson).toList()),
      ),
      authEventsProvider.overrideWithValue(const Stream<AuthState>.empty()),
      currentSessionReaderProvider.overrideWithValue(
        () => signedIn ? _session : null,
      ),
    ],
  );
  // Resolve the auth seed before routing: there are no native auth events to
  // refresh a router that first reads the session in its loading state.
  await container.read(sessionProvider.future);
  await container.read(onboardingDraftProvider.future);
  final router = container.read(routerProvider);
  var disposed = false;
  Future<void> dispose() async {
    if (disposed) return;
    disposed = true;
    await tester.pumpWidget(const SizedBox.shrink());
    router.dispose();
    container.dispose();
    api.close();
    await tester.pump();
    expect(
      errors.values,
      isEmpty,
      reason: 'A populated surface must not hide a provider error',
    );
  }

  addTearDown(dispose);
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: EasyLocalization(
        supportedLocales: const [Locale('en')],
        startLocale: const Locale('en'),
        fallbackLocale: const Locale('en'),
        path: 'assets/l10n',
        assetLoader: const FsL10nLoader(),
        child: Builder(
          builder:
              (context) => MaterialApp.router(
                debugShowCheckedModeBanner: false,
                theme: kalloAppTheme(),
                builder:
                    (context, child) => MediaQuery(
                      data: MediaQuery.of(
                        context,
                      ).copyWith(textScaler: TextScaler.linear(textScale)),
                      child: child!,
                    ),
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
  router.go(route);
  await settlePose(tester);
  expect(router.routeInformationProvider.value.uri.path, route);
  return dispose;
}

/// The paywall bun deliberately ticks forever (even with reduced motion).
/// Advance its complete sentence and finite route animations; do not wait for
/// the idle blink/breath to stop. All other surfaces must genuinely settle.
Future<void> settlePose(WidgetTester tester) async {
  // Let route construction and async fixture delivery finish before checking
  // for the mascot (the entitlement initially builds a loading face).
  for (var i = 0; i < 10; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
  if (find.byType(BunMascot).evaluate().isNotEmpty) {
    for (var i = 0; i < 60; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }
    await tester.runAsync(() async {
      await Future<void>.delayed(const Duration(milliseconds: 50));
    });
    await tester.pump();
  } else {
    await tester.pumpAndSettle();
  }
}

class _ProviderErrors extends ProviderObserver {
  final values = <String>[];

  @override
  void didUpdateProvider(
    ProviderBase<Object?> provider,
    Object? previousValue,
    Object? newValue,
    ProviderContainer container,
  ) {
    if (newValue is AsyncError) {
      values.add('${provider.name}: ${newValue.error}');
    }
  }
}
