import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/auth/widgets/welcome/apple_button.dart';
import 'package:kallo_mobile/features/auth/widgets/welcome/auth_brand_hero.dart';
import 'package:kallo_mobile/features/auth/widgets/welcome/auth_legal_links.dart';
import 'package:kallo_mobile/features/auth/widgets/welcome/google_button.dart';
import 'package:kallo_mobile/features/auth/widgets/welcome/welcome_demo.dart';
import 'package:kallo_mobile/features/onboarding/screens/save_plan_screen.dart';
import 'package:kallo_mobile/features/onboarding/widgets/backdrop/backdrop_slice.dart';
import 'package:kallo_mobile/features/onboarding/widgets/backdrop/step_backdrop.dart';
import 'package:kallo_mobile/shared/widgets/mascot/bun_mascot.dart';

import '../../app_fonts.dart';
import '../../l10n_test_loader.dart';

/// A phone-sized surface with no insets, so a measured rect is the design's
/// own number.
const _phone = Size(390, 844);

/// `/save-plan` is the wizard's seventh beat, not a login wall: the same three
/// options as `/sign-in`, under the onboarding chrome, with no way past them —
/// the app is authenticated-only and the plan is sitting in a local draft.
Widget _app() => ProviderScope(
      child: EasyLocalization(
        supportedLocales: const [Locale('en')],
        path: 'assets/l10n',
        fallbackLocale: const Locale('en'),
        assetLoader: const FsL10nLoader(),
        child: Builder(
          builder: (context) => MaterialApp(
            localizationsDelegates: context.localizationDelegates,
            supportedLocales: context.supportedLocales,
            locale: context.locale,
            home: Builder(
              builder: (inner) => MediaQuery(
                // The bun breathes on an endless Ticker, so `pumpAndSettle`
                // would never return; reduced motion also drops the typewriter
                // so the guide line is on screen from the first frame.
                data: MediaQuery.of(inner).copyWith(disableAnimations: true),
                child: const SavePlanScreen(),
              ),
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
    // Without the real font metrics every glyph renders ~1em wide and the auth
    // buttons' rows overflow — see AGENTS.md §4.
    await loadAppFonts();
  });

  testWidgets('asks for the account under the wizard chrome', (tester) async {
    // Apple is only offered on Apple platforms. Reset inside the body: the
    // framework asserts every foundation debug var is unset when it returns.
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    addTearDown(() => debugDefaultTargetPlatformOverride = null);
    tester.view.physicalSize = _phone;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(_app());
    // Fixed frames, never `pumpAndSettle`: the mascot's ticker never settles.
    for (var i = 0; i < 8; i++) {
      await tester.pump(const Duration(milliseconds: 120));
    }

    // The onboarding chrome: the bun says why, the title says what — on the
    // same gradient backdrop the wizard steps wear. The auth face is opaque,
    // so it gets a slice of the SAME field rather than a flat canvas fill,
    // which is why the backdrop is found twice.
    expect(find.byType(StepBackdrop), findsNWidgets(2));
    expect(find.byType(BackdropSlice), findsOneWidget);
    expect(find.byType(BunMascot), findsOneWidget);
    expect(
      find.text('Sign in so your plan follows you to every device.'),
      findsOneWidget,
    );
    expect(find.text('Save your plan'), findsOneWidget);

    // All three options, and the legal footnote that comes with them.
    expect(find.byType(AppleButton), findsOneWidget);
    expect(find.byType(GoogleButton), findsOneWidget);
    expect(find.text('Continue with email'), findsOneWidget);
    expect(
      find.text('By continuing you agree to our terms and privacy policy.'),
      findsOneWidget,
    );

    // …but NOT the sign-in screen's brand block: one wordmark, one pitch.
    expect(find.byType(AuthBrandHero), findsNothing);
    expect(find.byType(WelcomeDemo), findsNothing);

    // No way past it: no "Later", no skip.
    expect(find.text('Later'), findsNothing);
    expect(find.text('Skip'), findsNothing);

    // The options are BOTTOM-anchored, not centred in the leftover space
    // under the title (the canvas hangs them off the bottom edge). Nothing
    // sits below Apple but the two quieter options and the legal block, and
    // the block itself ends on the bottom inset.
    final apple = tester.getRect(find.byType(AppleButton));
    final legal = tester.getRect(find.byType(AuthLegalLinks));
    expect(_phone.height - apple.bottom, lessThan(250));
    expect(legal.bottom, greaterThan(_phone.height - 20));

    debugDefaultTargetPlatformOverride = null;
  });
}
