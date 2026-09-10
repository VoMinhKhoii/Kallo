import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:kallo_mobile/features/auth/screens/sign_in_screen.dart';
import 'package:kallo_mobile/shell/header/app_header_back_button.dart';

import '../../app_fonts.dart';
import '../../l10n_test_loader.dart';

/// `/sign-in` had no way back at all: `/start`'s "I already have an account"
/// replaced the stack, and the destination drew no chevron. Both halves are
/// fixed, and the chevron is conditional — it must not offer a button that
/// does nothing on the entries that really are the whole stack (the sign-out
/// row, a deleted account, an invite that needs signing in).
GoRouter _router() => GoRouter(
  initialLocation: '/start',
  routes: [
    GoRoute(
      path: '/start',
      builder: (context, state) => Scaffold(
        body: Center(
          child: TextButton(
            onPressed: () => context.push('/sign-in'),
            child: const Text('have-account'),
          ),
        ),
      ),
    ),
    GoRoute(path: '/sign-in', builder: (_, _) => const SignInScreen()),
  ],
);

Widget _app(GoRouter router) => ProviderScope(
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

  testWidgets('pushed from /start, sign-in draws a chevron that goes back', (
    tester,
  ) async {
    final router = _router();
    addTearDown(router.dispose);
    await tester.pumpWidget(_app(router));
    await tester.pumpAndSettle();

    await tester.tap(find.text('have-account'));
    await tester.pumpAndSettle();
    expect(router.state.matchedLocation, '/sign-in');
    expect(find.byType(AppHeaderBackButton), findsOneWidget);

    await tester.tap(find.byType(AppHeaderBackButton));
    await tester.pumpAndSettle();

    expect(router.state.matchedLocation, '/start');
  });

  testWidgets('reached cold, sign-in draws no chevron', (tester) async {
    final router = _router();
    addTearDown(router.dispose);
    await tester.pumpWidget(_app(router));
    await tester.pumpAndSettle();

    router.go('/sign-in');
    await tester.pumpAndSettle();

    expect(find.byType(AppHeaderBackButton), findsNothing);
  });
}
