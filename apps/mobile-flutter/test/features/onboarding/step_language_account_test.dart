import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kallo_mobile/features/onboarding/data/profile_row.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_providers.dart';
import 'package:kallo_mobile/features/onboarding/screens/step_language.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

import 'onboarding_test_support.dart';

/// Every step-1 post, held on the wire until [release]; refused with [fail].
class _Server extends ApiClient {
  String account = 'en';
  final List<String> posted = [];
  Completer<void> hold = Completer<void>();
  bool fail = false;

  void release() => hold.complete();

  @override
  Future<T> post<T>(String path, [Object? body]) async {
    final language =
        ((body! as Map)['data'] as Map)['preferredLocale'] as String;
    posted.add(language);
    await hold.future;
    if (fail) throw StateError('refused');
    account = language;
    return <String, dynamic>{} as T;
  }
}

/// Signed in, the account holds the language push text is written in, and
/// the app follows it: a pick is stored there first and shown after, so the
/// app never speaks a language the account does not hold.
void main() {
  setUpAll(initOnboardingTest);

  late _Server server;
  late BuildContext app;

  Future<void> mount(WidgetTester tester) async {
    server = _Server();
    final answers = testAnswers();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          signedInUserIdProvider.overrideWithValue(testUserId),
          apiClientProvider.overrideWithValue(server),
          profileProvider.overrideWith(
            (ref) async => ProfileRow({'preferredLocale': server.account}),
          ),
        ],
        child: localizedHome(
          Scaffold(
            body: Builder(
              builder: (context) {
                app = context;
                return StepLanguage(
                  answers: answers,
                  deviceLanguage: 'en',
                  localeFromDevice: false,
                  onChanged: () {},
                );
              },
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  // Fixed frames while a save is out.
  Future<void> frames(WidgetTester tester) async {
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  testWidgets('switches once the account holds it; a second tap waits', (
    tester,
  ) async {
    await mount(tester);

    await tester.tap(find.text('Tiếng Việt'));
    await frames(tester);
    expect(app.locale.languageCode, 'en', reason: 'not stored yet');
    await tester.tap(find.text('Tiếng Việt'));
    await frames(tester);
    expect(server.posted, ['vi'], reason: 'a tap while saving waits');

    server.release();
    await tester.pumpAndSettle();
    expect(server.account, 'vi');
    expect(app.locale.languageCode, 'vi');
  });

  testWidgets('a refused save leaves the app as it was and says so', (
    tester,
  ) async {
    await mount(tester);
    server.fail = true;

    await tester.tap(find.text('Tiếng Việt'));
    await frames(tester);
    server.release();
    await tester.pumpAndSettle();

    expect(server.account, 'en');
    expect(app.locale.languageCode, 'en');
    expect(find.text(tr('settings.profilePanel.saveError')), findsOneWidget);
  });
}
