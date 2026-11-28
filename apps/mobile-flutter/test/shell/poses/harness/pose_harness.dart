import 'dart:math';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/onboarding/widgets/start/start_preview_box.dart';
import 'package:kallo_mobile/router.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_draft_providers.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/shell/kallo_app_theme.dart';
import 'package:kallo_mobile/shell/nav/nav_actions.dart';
import 'package:kallo_mobile/shared/widgets/mascot/bun_mascot.dart';

import '../../../app_fonts.dart';
import '../../../l10n_test_loader.dart';
import 'fixture_api.dart';
import 'fixtures.dart';
import 'keep_clear_tint.dart';
import 'pose_overrides.dart';
import '../../../features/circle/circle_feed_test_support.dart';
import 'poses.dart';

/// The language the poses render in: `--dart-define=POSE_LOCALE=vi` draws
/// the gallery in Vietnamese, strings and fixture meals both. Tests that
/// look for English words only pass in English.
const _locale = String.fromEnvironment('POSE_LOCALE', defaultValue: 'en');

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
  FakeApiClient? apiOverride,
  List<Override> overrides = const [],
  bool keepClearTint = false,
  String locale = _locale,
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

  final fixtures = PoseFixtures(locale: locale);
  final api = apiOverride ?? fixtureApi(fixtures);
  final errors = _ProviderErrors();
  final container = ProviderContainer(
    observers: [errors],
    overrides: [
      ...poseOverrides(fixtures: fixtures, api: api, signedIn: signedIn),
      ...overrides,
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
        supportedLocales: const [Locale('en'), Locale('vi')],
        startLocale: Locale(locale),
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
                      child:
                          keepClearTint ? KeepClearTint(child: child!) : child!,
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
  // Log is reached the way the app reaches it: pushed over the tab shell,
  // so a window with a control column shows the shell's capsule beside it.
  if (route == '/logging') {
    openLogging(router);
  } else {
    router.go(route);
  }
  await settlePose(tester);
  // A push does not move the reported URL; the top route's location does.
  expect(
    route == '/logging'
        ? router.state.matchedLocation
        : router.routeInformationProvider.value.uri.path,
    route,
  );
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
    // The start preview's dishes are assets, and an asset only decodes in
    // real time. Without this the first screen to show the preview renders
    // an empty device.
    if (find.byType(StartPreviewBox).evaluate().isNotEmpty) {
      await tester.runAsync(() async {
        await Future<void>.delayed(const Duration(milliseconds: 50));
      });
      await tester.pump();
    }
  }
}

/// Moves the running app to [pose]'s window: size, insets and padding, as a
/// fold, a rotation or Split View would.
void resize(WidgetTester tester, Pose pose) {
  final dpr = pose.devicePixelRatio;
  tester.view.physicalSize = pose.size * dpr;
  final padding = FakeViewPadding(
    left: pose.padding.left * dpr,
    top: pose.padding.top * dpr,
    right: pose.padding.right * dpr,
    bottom: pose.padding.bottom * dpr,
  );
  tester.view.padding = padding;
  tester.view.viewPadding = padding;
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
