import 'dart:async';
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
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../l10n_test_loader.dart';
import '../onboarding/onboarding_test_support.dart' show testSession;

/// Users saw English reminder text under Vietnamese buttons: the buttons
/// follow the app's language, the text the account's, and the two drifted.
/// The app now follows the account, after storing a language picked on this
/// phone once.

/// The account on the server: a step-1 post stores its language.
class _Server extends ApiClient {
  _Server(this.account);

  String account;
  final List<Object?> posts = [];

  @override
  Future<T> post<T>(String path, [Object? body]) async {
    posts.add(body);
    final data = (body! as Map)['data'] as Map;
    if (data['preferredLocale'] case final String language) account = language;
    return <String, dynamic>{} as T;
  }
}

/// A keychain read while the phone is locked.
class _LockedStore extends InMemoryKeyValueStore {
  @override
  Future<String?> read(String key) async =>
      throw PlatformException(code: 'locked');
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

  // Every test but the last starts on a phone where the person picked
  // Vietnamese in an earlier launch (easy_localization reads that once).
  group('AccountLanguageSync', () {
    setUpAll(() async {
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

    late _Server server;
    late InMemoryKeyValueStore flags;
    late InMemoryKeyValueStore draft;
    late StreamController<Session?> session;
    late BuildContext app;

    setUp(() {
      server = _Server('en');
      flags = InMemoryKeyValueStore();
      draft = InMemoryKeyValueStore();
    });

    void repaired() => flags.values[kAccountLanguageRepairedKey] = '1';

    /// Riverpod flushes provider changes on frames, and nothing here rebuilds
    /// on its own, so a few frames are pumped before settling.
    Future<void> settle(WidgetTester tester) async {
      for (var i = 0; i < 5; i++) {
        await tester.pump(const Duration(milliseconds: 16));
      }
      await tester.pumpAndSettle();
    }

    Future<void> mount(WidgetTester tester, {Session? signedIn}) async {
      // Made inside the test body: fake async only drives what its own zone
      // schedules.
      session = StreamController<Session?>.broadcast();
      addTearDown(session.close);
      final first = signedIn;
      await tester.pumpWidget(
        EasyLocalization(
          supportedLocales: const [Locale('en'), Locale('vi')],
          path: 'assets/l10n',
          startLocale: const Locale('en'),
          fallbackLocale: const Locale('en'),
          assetLoader: const FsL10nLoader(),
          child: ProviderScope(
            overrides: [
              sessionProvider.overrideWith((ref) async* {
                yield first;
                yield* session.stream;
              }),
              // Not keyed on the session as the real one is: a rebuild on a
              // session change never settles under the widget tester. The
              // sync reads the session itself.
              profileProvider.overrideWith(
                (ref) async => ProfileRow({'preferredLocale': server.account}),
              ),
              apiClientProvider.overrideWithValue(server),
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
      await settle(tester);
    }

    String appLanguage() => EasyLocalization.of(app)!.locale.languageCode;
    Future<void> setAppLanguage(WidgetTester tester, String code) async {
      await EasyLocalization.of(app)!.setLocale(Locale(code));
      await settle(tester);
    }

    Future<void> refetch(WidgetTester tester) async {
      ProviderScope.containerOf(app).invalidate(profileProvider);
      await settle(tester);
    }

    testWidgets('stores the phone\'s pick on the account, once', (
      tester,
    ) async {
      await mount(tester, signedIn: testSession());

      expect(server.posts, [
        {
          'step': 1,
          'data': {'preferredLocale': 'vi'},
          'advance': false,
        },
      ]);
      expect(server.account, 'vi');
      expect(appLanguage(), 'vi');
      expect(flags.values[kAccountLanguageRepairedKey], isNotNull);
    });

    testWidgets('after the repair, the app follows the account', (
      tester,
    ) async {
      repaired();
      await mount(tester, signedIn: testSession());

      expect(server.posts, isEmpty);
      expect(appLanguage(), 'en');
    });

    testWidgets('waits for a signed-out draft to be posted, then follows', (
      tester,
    ) async {
      repaired();
      draft.values[kOnboardingDraftKey] = jsonEncode(
        const OnboardingDraft(screenReached: 2).toJson(),
      );
      await mount(tester, signedIn: testSession());
      expect(appLanguage(), 'vi');

      await ProviderScope.containerOf(
        app,
      ).read(onboardingDraftProvider.notifier).clear();
      await settle(tester);
      expect(appLanguage(), 'en');
    });

    testWidgets('follows a language changed on the web, mid-session', (
      tester,
    ) async {
      repaired();
      server.account = 'vi';
      await mount(tester, signedIn: testSession());
      expect(appLanguage(), 'vi');

      server.account = 'en';
      await refetch(tester);
      expect(appLanguage(), 'en');
    });

    testWidgets('a refetch still carrying the old language keeps a new pick', (
      tester,
    ) async {
      repaired();
      server.account = 'vi';
      await mount(tester, signedIn: testSession());

      // Picked in Settings; its save has not landed yet.
      await setAppLanguage(tester, 'en');
      await refetch(tester);
      expect(appLanguage(), 'en');
    });

    testWidgets('signing back into the same account follows it again', (
      tester,
    ) async {
      repaired();
      server.account = 'vi';
      await mount(tester, signedIn: testSession());

      session.add(null);
      await settle(tester);
      await setAppLanguage(tester, 'en');
      session.add(testSession());
      await settle(tester);

      expect(appLanguage(), 'vi');
    });

    testWidgets('a locked keychain changes nothing', (tester) async {
      flags = _LockedStore();
      await mount(tester, signedIn: testSession());

      expect(server.posts, isEmpty);
      expect(appLanguage(), 'vi');
    });

    testWidgets('after a signed-out start, the next account is followed', (
      tester,
    ) async {
      await mount(tester);
      session.add(testSession());
      await settle(tester);

      // The phone's pick may be someone else's: no repair.
      expect(server.posts, isEmpty);
      expect(appLanguage(), 'en');
    });

    // Last: it clears the pick the earlier tests start from.
    testWidgets('a new phone opens in the account\'s language', (tester) async {
      await mount(tester);
      await EasyLocalization.of(app)!.deleteSaveLocale();
      server.account = 'vi';

      // A fresh mount reads "nothing picked" and starts on English.
      await tester.pumpWidget(const SizedBox());
      await mount(tester, signedIn: testSession());

      expect(appLanguage(), 'vi');
      expect(server.posts, isEmpty);
    });
  });
}
