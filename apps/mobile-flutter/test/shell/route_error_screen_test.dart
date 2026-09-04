import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:kallo_mobile/shared/widgets/surface/kallo_primitives.dart';
import 'package:kallo_mobile/shell/route_error_screen.dart';

import '../l10n_test_loader.dart';

/// The router's two failures are not the same message: a location with no
/// screen behind it says "page not found", a route that threw says the app
/// broke. Both offer exactly one way out.
Widget _app({required bool notFound}) => EasyLocalization(
      supportedLocales: const [Locale('en')],
      path: 'assets/l10n',
      fallbackLocale: const Locale('en'),
      assetLoader: const FsL10nLoader(),
      child: Builder(
        builder: (context) => MaterialApp.router(
          localizationsDelegates: context.localizationDelegates,
          supportedLocales: context.supportedLocales,
          locale: context.locale,
          routerConfig: GoRouter(
            initialLocation: '/',
            routes: [
              GoRoute(
                path: '/',
                builder: (_, __) => RouteErrorScreen(notFound: notFound),
              ),
            ],
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

  testWidgets('a route that threw reads as an error, with one way out',
      (tester) async {
    await tester.pumpWidget(_app(notFound: false));
    await tester.pumpAndSettle();

    expect(find.text('This didn’t load.'), findsOneWidget);
    expect(find.text('Page not found'), findsNothing);
    expect(find.byType(KalloButton), findsOneWidget);
  });

  testWidgets('an unmatched location reads as a 404', (tester) async {
    await tester.pumpWidget(_app(notFound: true));
    await tester.pumpAndSettle();

    expect(find.text('Page not found'), findsOneWidget);
    expect(find.text('This didn’t load.'), findsNothing);
    expect(find.byType(KalloButton), findsOneWidget);
  });
}
