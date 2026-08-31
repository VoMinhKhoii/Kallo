import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:kallo_mobile/features/dashboard/data/dashboard_providers.dart';
import 'package:kallo_mobile/features/dashboard/widgets/weight/weight_log_sheet.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';

import '../../l10n_test_loader.dart';

/// "Log weight" from the "+" Add sheet reads the dashboard bundle for its
/// prefills before it can present. That await had no error branch, so a failed
/// bundle (offline, 500) made the row do NOTHING — the Add sheet closed and no
/// sheet ever arrived. The user is owed a reason.
const _userId = '11111111-1111-1111-1111-111111111111';

final _session = Session(
  accessToken: 'token',
  tokenType: 'bearer',
  user: const User(
    id: _userId,
    appMetadata: {},
    userMetadata: {},
    aud: 'authenticated',
    createdAt: '2026-07-28T00:00:00.000Z',
  ),
);

Widget _app({required bool bundleFails}) => ProviderScope(
      overrides: [
        currentSessionProvider.overrideWithValue(_session),
        if (bundleFails)
          dashboardBundleProvider.overrideWith(
            (ref, args) async => throw Exception('bundle boom'),
          ),
      ],
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
            home: Scaffold(
              body: Consumer(
                builder: (context, ref, _) => TextButton(
                  onPressed: () => showWeightLogSheet(context, ref),
                  child: const Text('log weight'),
                ),
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
  });

  testWidgets('a failed dashboard bundle surfaces a toast, not a dead end',
      (tester) async {
    await tester.pumpWidget(_app(bundleFails: true));
    await tester.pumpAndSettle();

    await tester.tap(find.text('log weight'));
    await tester.pumpAndSettle();

    // The failure must not escape as an unhandled error...
    expect(tester.takeException(), isNull);
    // ...and the user must be told why nothing opened.
    expect(
      find.text("Couldn't open the weight logger. Please try again."),
      findsOneWidget,
      reason: 'the failed bundle dead-ended silently',
    );
  });
}
