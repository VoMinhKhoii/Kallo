import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:kallo_mobile/features/auth/screens/sign_in_screen.dart';
import 'package:kallo_mobile/features/auth/widgets/welcome/apple_button.dart';
import 'package:kallo_mobile/features/auth/widgets/welcome/auth_brand_hero.dart';
import 'package:kallo_mobile/features/auth/widgets/welcome/auth_legal_links.dart';
import 'package:kallo_mobile/features/onboarding/widgets/backdrop/step_backdrop.dart';

import '../../app_fonts.dart';
import '../../l10n_test_loader.dart';

/// The welcome face is the wordmark, one line and the three ways in: no typing
/// demo, the buttons hung off the bottom like `/start`'s, on the same gradient
/// field as the email screen it pushes.
Widget _app({required EdgeInsets insets, double textScale = 1}) {
  final router = GoRouter(
    initialLocation: '/sign-in',
    routes: [GoRoute(path: '/sign-in', builder: (_, _) => const SignInScreen())],
  );
  return ProviderScope(
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
              routerConfig: router,
              builder:
                  (inner, child) => MediaQuery(
                    data: MediaQuery.of(inner).copyWith(
                      padding: insets,
                      viewPadding: insets,
                      textScaler: TextScaler.linear(textScale),
                    ),
                    child: child!,
                  ),
            ),
      ),
    ),
  );
}

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

  Future<void> pump(
    WidgetTester tester,
    Size phone, {
    EdgeInsets insets = const EdgeInsets.only(top: 59, bottom: 34),
    double textScale = 1,
  }) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    tester.view.physicalSize = phone;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(_app(insets: insets, textScale: textScale));
    await tester.pumpAndSettle();
  }

  testWidgets('wordmark and one line above, buttons on the bottom inset', (
    tester,
  ) async {
    const phone = Size(393, 852);
    await pump(tester, phone);

    expect(find.text('Log meals the way you say them'), findsOneWidget);
    expect(find.textContaining('kcal'), findsNothing);

    final screen = tester.getRect(find.byType(SignInScreen));
    expect(tester.getRect(find.byType(StepBackdrop)), screen);

    // The legal block ends 12pt over the 34pt home-indicator inset.
    final legal = tester.getRect(find.byType(AuthLegalLinks));
    expect(legal.bottom, closeTo(phone.height - 34 - 12, 1));

    // The brand block is centred in the space above the buttons, not stacked
    // on top of them.
    final brand = tester.getRect(find.byType(AuthBrandHero));
    final apple = tester.getRect(find.byType(AppleButton));
    expect(apple.top - brand.bottom, greaterThan(150));
    expect(brand.top, greaterThan(59 + 150));

    debugDefaultTargetPlatformOverride = null;
  });

  testWidgets('a viewport too short for the face scrolls instead of '
      'overflowing', (tester) async {
    // Shorter than the face's own height (wordmark, line, the 32pt floor and
    // the options stack), as large text or a landscape split view makes it.
    const phone = Size(393, 360);
    await pump(tester, phone, insets: EdgeInsets.zero);

    expect(tester.takeException(), isNull);
    expect(
      tester.getRect(find.byType(AuthLegalLinks)).bottom,
      greaterThan(phone.height),
    );
    await tester.drag(find.byType(AuthBrandHero), const Offset(0, -300));
    await tester.pumpAndSettle();
    expect(
      tester.getRect(find.byType(AuthLegalLinks)).bottom,
      lessThanOrEqualTo(phone.height),
    );

    debugDefaultTargetPlatformOverride = null;
  });

  testWidgets('a face that fits does not scroll', (tester) async {
    await pump(tester, const Size(393, 852));

    final before = tester.getRect(find.byType(AuthBrandHero));
    await tester.drag(find.byType(AuthBrandHero), const Offset(0, -200));
    await tester.pumpAndSettle();
    expect(tester.getRect(find.byType(AuthBrandHero)), before);

    debugDefaultTargetPlatformOverride = null;
  });
}
