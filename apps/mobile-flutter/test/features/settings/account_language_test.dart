import 'dart:convert';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/onboarding/data/onboarding_draft.dart';
import 'package:kallo_mobile/features/onboarding/data/profile_row.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_draft_providers.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_providers.dart';
import 'package:kallo_mobile/features/settings/logic/account_language.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

import '../../l10n_test_loader.dart';

/// Users saw English reminder text under Vietnamese buttons: the buttons
/// follow the app's language, the text the account's, and the two drifted.
/// The app now follows the account, after storing a language picked on this
/// phone once.
class _RecordingApi extends ApiClient {
  final List<Object?> posts = [];

  @override
  Future<T> post<T>(String path, [Object? body]) async {
    posts.add(body);
    return <String, dynamic>{} as T;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('decideAccountLanguage', () {
    AccountLanguageStep decide(
      String? account,
      String app, {
      bool picked = true,
      bool pending = false,
    }) => decideAccountLanguage(
      account: account,
      app: app,
      appPicked: picked,
      repairPending: pending,
    );

    test('does nothing when the two agree or the account has none', () {
      expect(decide('vi', 'vi', pending: true), AccountLanguageStep.none);
      expect(decide(null, 'vi', pending: true), AccountLanguageStep.none);
    });

    test('stores a pick made on this phone, once', () {
      expect(decide('en', 'vi', pending: true), AccountLanguageStep.repair);
      expect(decide('en', 'vi'), AccountLanguageStep.adopt);
    });

    test('a phone with no pick follows the account', () {
      expect(
        decide('vi', 'en', picked: false, pending: true),
        AccountLanguageStep.adopt,
      );
    });
  });

  group('AccountLanguageSync', () {
    setUpAll(() async {
      // A phone where the person picked Vietnamese in an earlier launch.
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
            const MethodChannel('plugins.flutter.io/shared_preferences'),
            (call) async =>
                call.method == 'getAll'
                    ? <String, Object>{'flutter.locale': 'vi'}
                    : true,
          );
      await EasyLocalization.ensureInitialized();
    });

    late _RecordingApi api;
    late InMemoryKeyValueStore flags;
    late InMemoryKeyValueStore draft;
    late String account;
    late BuildContext app;

    setUp(() {
      api = _RecordingApi();
      flags = InMemoryKeyValueStore();
      draft = InMemoryKeyValueStore();
      account = 'en';
    });

    Future<void> mount(WidgetTester tester) async {
      await tester.pumpWidget(
        EasyLocalization(
          supportedLocales: const [Locale('en'), Locale('vi')],
          path: 'assets/l10n',
          startLocale: const Locale('en'),
          fallbackLocale: const Locale('en'),
          assetLoader: const FsL10nLoader(),
          child: ProviderScope(
            overrides: [
              signedInUserIdProvider.overrideWithValue('user-1'),
              profileProvider.overrideWith(
                (ref) async => ProfileRow({'preferredLocale': account}),
              ),
              apiClientProvider.overrideWithValue(api),
              accountLanguageStorageProvider.overrideWithValue(flags),
              onboardingDraftStoreProvider.overrideWithValue(
                OnboardingDraftStore(storage: draft),
              ),
            ],
            child: AccountLanguageSync(
              child: Builder(
                builder: (context) {
                  app = context;
                  return const SizedBox();
                },
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
    }

    String appLanguage() => EasyLocalization.of(app)!.locale.languageCode;

    testWidgets('stores the phone\'s pick on the account once, and keeps it', (
      tester,
    ) async {
      await mount(tester);

      expect(api.posts, [
        {
          'step': 1,
          'data': {'preferredLocale': 'vi'},
          'advance': false,
        },
      ]);
      expect(appLanguage(), 'vi');
      expect(flags.values[kAccountLanguageRepairedKey], isNotNull);
    });

    testWidgets('after the repair, the app follows the account', (
      tester,
    ) async {
      flags.values[kAccountLanguageRepairedKey] = '1';
      await mount(tester);

      expect(api.posts, isEmpty);
      expect(appLanguage(), 'en');
    });

    testWidgets('waits while a signed-out draft is still to be posted', (
      tester,
    ) async {
      flags.values[kAccountLanguageRepairedKey] = '1';
      draft.values[kOnboardingDraftKey] = jsonEncode(
        const OnboardingDraft(screenReached: 2).toJson(),
      );
      await mount(tester);

      expect(appLanguage(), 'vi');
      expect(api.posts, isEmpty);
    });

    testWidgets('follows a language changed elsewhere, mid-session', (
      tester,
    ) async {
      flags.values[kAccountLanguageRepairedKey] = '1';
      account = 'vi';
      await mount(tester);
      expect(appLanguage(), 'vi');

      // Changed on the web; the next profile fetch carries it.
      account = 'en';
      ProviderScope.containerOf(app).invalidate(profileProvider);
      await tester.pumpAndSettle();
      expect(appLanguage(), 'en');
    });

    // Last: it clears the pick the earlier tests start from.
    testWidgets('a new phone opens in the account\'s language', (tester) async {
      await mount(tester);
      await EasyLocalization.of(app)!.deleteSaveLocale();
      api.posts.clear();
      flags.values.clear();
      account = 'vi';

      // A fresh mount reads "nothing picked" and starts on English.
      await tester.pumpWidget(const SizedBox());
      await mount(tester);

      expect(appLanguage(), 'vi');
      expect(api.posts, isEmpty);
    });
  });
}
