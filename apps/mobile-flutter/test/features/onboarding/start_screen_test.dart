import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:kallo_mobile/features/onboarding/screens/start_screen.dart';
import 'package:kallo_mobile/shared/widgets/brand/kallo_wordmark.dart';
import 'package:kallo_mobile/shared/widgets/surface/kallo_primitives.dart';

import '../../app_fonts.dart';
import '../../l10n_test_loader.dart';

/// `/start` is the first thing a new install sees, and it is the ONLY screen
/// with two ways out of it — the wizard and the existing account — so both are
/// asserted here rather than left to the router test.

/// The smallest phone Kallo supports, at the largest text scale iOS offers
/// without the accessibility sizes.
const _small = Size(320, 568);

GoRouter _router() => GoRouter(
      initialLocation: '/start',
      routes: [
        GoRoute(path: '/start', builder: (_, __) => const StartScreen()),
        GoRoute(
          path: '/onboarding',
          builder: (_, __) => const Text('wizard'),
        ),
        GoRoute(path: '/sign-in', builder: (_, __) => const Text('auth')),
      ],
    );

Widget _app(GoRouter router, {TextScaler scale = TextScaler.noScaling}) =>
    ProviderScope(
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
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(context).copyWith(textScaler: scale),
              child: child!,
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
    await loadAppFonts();
  });

  testWidgets('brands the screen and offers both ways in', (tester) async {
    final router = _router();
    await tester.pumpWidget(_app(router));
    await tester.pumpAndSettle();

    expect(find.byType(KalloWordmark), findsOneWidget);
    expect(find.text('Log meals the way you say them'), findsOneWidget);

    // The CTA starts the wizard — signed out, before any account exists.
    await tester.tap(find.text('Get started'));
    await tester.pumpAndSettle();
    expect(router.state.matchedLocation, '/onboarding');

    router.go('/start');
    await tester.pumpAndSettle();

    // The quiet link is the way back for an account that already exists.
    await tester.tap(find.text('I already have an account'));
    await tester.pumpAndSettle();
    expect(router.state.matchedLocation, '/sign-in');
  });

  /// The canvas anatomy: the promise is pinned INTO the preview's dissolve —
  /// its top 28pt above the card's bottom edge, which the 150pt fade has been
  /// solid canvas for the last 37.5pt of — with the design's 24pt of air (at
  /// least) between it and the CTA. The numbers are the design's own, read
  /// back through the scale the screen actually applied to the card.
  void expectTitlePinnedIntoTheFade(WidgetTester tester) {
    final preview = tester.getRect(find.byKey(StartScreen.previewKey));
    final double scale = preview.width / 226;
    final title = tester.getRect(find.text('Log meals the way you say them'));
    final cta = tester.getRect(find.byType(KalloButton));

    expect(scale, lessThanOrEqualTo(1.0));
    expect(
      title.top,
      closeTo(preview.bottom - 28 * scale, 0.5),
      reason: 'the title left the dissolved band',
    );
    expect(
      cta.top - title.bottom,
      greaterThanOrEqualTo(24 - 0.5),
      reason: 'the promise is crowding the button',
    );
  }

  testWidgets('the title sits in the preview\'s fade, not on the device',
      (tester) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(390, 844);
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_app(_router()));
    await tester.pumpAndSettle();

    expectTitlePinnedIntoTheFade(tester);
  });

  testWidgets('holds at 320x568 with 1.3x text', (tester) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = _small;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      _app(_router(), scale: const TextScaler.linear(1.3)),
    );
    await tester.pumpAndSettle();

    // Nothing overflowed, and the CTA is still on the phone: the preview is
    // the block that gives up height, not the button.
    expect(tester.takeException(), isNull);
    final cta = tester.getRect(find.byType(KalloButton));
    expect(cta.bottom, lessThanOrEqualTo(_small.height));
    expect(cta.right, lessThanOrEqualTo(_small.width));
    expect(find.text('I already have an account'), findsOneWidget);

    // …and the shrunken preview still holds the promise in its dissolve: the
    // block that gave up height did not drag the title onto the device.
    expectTitlePinnedIntoTheFade(tester);
  });
}
