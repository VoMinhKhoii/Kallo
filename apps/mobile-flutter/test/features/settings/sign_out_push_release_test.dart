import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:kallo_mobile/features/settings/widgets/account/sign_out_row.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/services/http/api_client.dart';
import 'package:kallo_mobile/services/push/push_service.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show GoTrueClient;

import '../../l10n_test_loader.dart';

/// Records the order of the two calls sign-out makes, which is the whole point:
/// the token release must ride the session's Bearer token, so it has to happen
/// BEFORE the session is torn down.
final List<String> _calls = [];

class _FakePushService extends PushService {
  _FakePushService() : super(ApiClient());

  @override
  Future<void> unregister() async => _calls.add('unregister');
}

class _FakeAuthController extends AuthController {
  // autoRefreshToken off: its ticker outlives the widget tree and trips the
  // test binding's pending-timer invariant.
  _FakeAuthController()
    : super(GoTrueClient(url: 'http://localhost', autoRefreshToken: false));

  @override
  Future<void> signOut() async => _calls.add('signOut');
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
  });

  setUp(_calls.clear);

  testWidgets('sign-out releases the push token before ending the session', (
    tester,
  ) async {
    final router = GoRouter(
      routes: [
        GoRoute(path: '/', builder: (_, __) => const SignOutRow()),
        GoRoute(path: '/sign-in', builder: (_, __) => const SizedBox.shrink()),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      EasyLocalization(
        supportedLocales: const [Locale('en')],
        path: 'assets/l10n',
        fallbackLocale: const Locale('en'),
        assetLoader: const FsL10nLoader(),
        child: Builder(
          builder:
              (context) => ProviderScope(
                overrides: [
                  pushServiceProvider.overrideWithValue(_FakePushService()),
                  authControllerProvider.overrideWithValue(
                    _FakeAuthController(),
                  ),
                ],
                child: MaterialApp.router(
                  routerConfig: router,
                  localizationsDelegates: context.localizationDelegates,
                  supportedLocales: context.supportedLocales,
                  locale: context.locale,
                ),
              ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byType(SignOutRow));
    await tester.pumpAndSettle();

    // The confirm dialog repeats the row's label; the dialog's copy is last.
    await tester.tap(find.text(tr('settings.account.signOut')).last);
    await tester.pumpAndSettle();

    expect(_calls, ['unregister', 'signOut']);
  });
}
