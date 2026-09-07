import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:kallo_mobile/features/auth/screens/email_auth_screen.dart';
import 'package:kallo_mobile/features/auth/widgets/auth_page.dart';
import 'package:kallo_mobile/features/auth/widgets/email_auth_form.dart';
import 'package:kallo_mobile/features/auth/widgets/welcome/apple_button.dart';
import 'package:kallo_mobile/features/auth/widgets/welcome/auth_legal_links.dart';
import 'package:kallo_mobile/features/auth/widgets/welcome/google_button.dart';
import 'package:kallo_mobile/features/onboarding/widgets/backdrop/step_backdrop.dart';

import '../../app_fonts.dart';
import '../../l10n_test_loader.dart';

/// "Continue with email" is a ROUTE now, not a face swapped inside [AuthPage]:
/// `/sign-in/email` from the welcome screen, `/save-plan/email` from the
/// post-onboarding step. That buys two things this file guards — a real back
/// stack (the chevron pops to whichever screen pushed it) and a per-entry
/// default mode (someone who just built a plan has no account yet).
///
/// The routes mirror `router.dart`'s nesting; the real one is unreachable in a
/// test because it wants a Supabase client.
GoRouter _router(String initialLocation) => GoRouter(
      initialLocation: initialLocation,
      routes: [
        GoRoute(
          path: '/sign-in',
          builder: (context, state) => const Scaffold(body: AuthPage()),
          routes: [
            GoRoute(
              path: 'email',
              builder: (context, state) =>
                  const EmailAuthScreen(createAccount: false),
            ),
          ],
        ),
        GoRoute(
          path: '/save-plan',
          builder: (context, state) =>
              const Scaffold(body: AuthPage(compact: true)),
          routes: [
            GoRoute(
              path: 'email',
              builder: (context, state) =>
                  const EmailAuthScreen(createAccount: true),
            ),
          ],
        ),
      ],
    );

Widget _app(String initialLocation) {
  final router = _router(initialLocation);
  return ProviderScope(
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
    // The real font, or every glyph measures ~1em and the mode toggle "wraps"
    // at a width it never wraps at on device.
    await loadAppFonts();
  });

  testWidgets('the email screen carries the form, BOTH social options and the '
      'legal footnote — nobody has to go back for them', (tester) async {
    // Apple is an iOS/macOS-only option, and the override has to be cleared
    // inside the body — the framework asserts on a foundation debug variable
    // still set when the test returns.
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    await tester.pumpWidget(_app('/sign-in/email'));
    await tester.pumpAndSettle();

    expect(find.byType(EmailAuthForm), findsOneWidget);
    expect(find.byType(AppleButton), findsOneWidget);
    expect(find.byType(GoogleButton), findsOneWidget);
    expect(find.byType(AuthLegalLinks), findsOneWidget);
    expect(find.text('or'), findsOneWidget);
    debugDefaultTargetPlatformOverride = null;
  });

  testWidgets('wears the wizard canvas, edge to edge behind the status bar', (
    tester,
  ) async {
    // `/save-plan/email` is pushed straight off `/save-plan`, so it has to
    // carry the same backdrop — and start it at y=0, not under the SafeArea,
    // or the sweep would begin with a flat band across the top.
    await tester.pumpWidget(_app('/save-plan/email'));
    await tester.pumpAndSettle();

    expect(find.byType(StepBackdrop), findsOneWidget);
    final screen = tester.getRect(find.byType(EmailAuthScreen));
    expect(tester.getRect(find.byType(StepBackdrop)), screen);
  });

  testWidgets('/sign-in/email opens in sign-in mode', (tester) async {
    await tester.pumpWidget(_app('/sign-in/email'));
    await tester.pumpAndSettle();

    expect(find.text('Welcome back'), findsOneWidget);
    expect(find.text('Sign In'), findsOneWidget);
  });

  testWidgets('/save-plan/email opens in sign-UP mode — whoever just built a '
      'plan has no account yet', (tester) async {
    await tester.pumpWidget(_app('/save-plan/email'));
    await tester.pumpAndSettle();

    expect(find.text('Create your account'), findsOneWidget);
    expect(find.text('Create Account'), findsOneWidget);
  });

  testWidgets('back from /save-plan/email returns to /save-plan, not to the '
      'sign-in screen', (tester) async {
    await tester.pumpWidget(_app('/save-plan'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Continue with email'));
    await tester.pumpAndSettle();
    expect(find.byType(EmailAuthScreen), findsOneWidget);
    expect(find.text('Create your account'), findsOneWidget);

    await tester.tap(find.bySemanticsLabel('Back'));
    await tester.pumpAndSettle();

    expect(find.byType(EmailAuthScreen), findsNothing);
    expect(find.text('Continue with email'), findsOneWidget);
  });
}
