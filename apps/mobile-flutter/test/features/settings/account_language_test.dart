import 'dart:async';
import 'dart:convert';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/onboarding/data/onboarding_draft.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_draft_providers.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_providers.dart';
import 'package:kallo_mobile/features/settings/logic/account_language.dart';
import 'package:kallo_mobile/features/settings/logic/language_picker.dart';
import 'package:kallo_mobile/models/http/api_error.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/services/http/api_client.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../l10n_test_loader.dart';
import '../onboarding/onboarding_test_support.dart' show testSession;

/// Users saw English reminder text under Vietnamese buttons: the buttons
/// follow the app's language, the text the account's, and the two drifted.
/// The app now follows the account, after storing a language picked on this
/// phone once.

/// The account on the server: a step-1 post stores its language. A post can
/// be held on the wire ([hold]) or refused ([fail]); a profile read can fail
/// once ([failReads]) or be delayed ([readDelay]).
class _Server extends ApiClient {
  _Server(this.account);

  String account;
  final List<Object?> posts = [];
  int reads = 0;
  Completer<void>? hold;
  Duration? readDelay;
  bool fail = false;
  int failReads = 0;

  @override
  Future<T> get<T>(String path) async {
    if (path != '/api/v1/onboarding/profile') {
      throw UnimplementedError('Unexpected GET $path');
    }
    reads++;
    if (readDelay != null) {
      await Future<void>.delayed(readDelay!);
    }
    if (failReads > 0) {
      failReads--;
      // Non-retryable so `runWithRetry` surfaces the failure on this attempt.
      throw ApiError('OFFLINE', 503, false, 'offline');
    }
    return <String, dynamic>{
          'preferredLocale': account,
          'heightCm': 175.0,
          'weightKg': 70.0,
        }
        as T;
  }

  @override
  Future<T> post<T>(String path, [Object? body]) async {
    posts.add(body);
    await hold?.future;
    if (fail) throw StateError('refused');
    final data = (body! as Map)['data'] as Map;
    if (data['preferredLocale'] case final String language) account = language;
    return <String, dynamic>{} as T;
  }
}

/// A keychain read that answers only when [answer] completes.
class _SlowStore extends InMemoryKeyValueStore {
  final Completer<void> answer = Completer<void>();

  @override
  Future<String?> read(String key) async {
    await answer.future;
    return super.read(key);
  }
}

Session _sessionFor(String id) => Session(
  accessToken: 'token',
  tokenType: 'bearer',
  user: User(
    id: id,
    appMetadata: const {},
    userMetadata: const {},
    aud: 'authenticated',
    createdAt: '2026-07-28T00:00:00.000Z',
  ),
);

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
    late StreamController<AuthState> authEvents;
    Session? activeSession;
    late BuildContext app;

    setUp(() {
      server = _Server('en');
      flags = InMemoryKeyValueStore();
      draft = InMemoryKeyValueStore();
      activeSession = null;
    });

    void repaired() => flags.values[kAccountLanguageRepairedKey] = '1';

    void setSession(Session? next) {
      activeSession = next;
      authEvents.add(
        AuthState(
          next == null ? AuthChangeEvent.signedOut : AuthChangeEvent.signedIn,
          next,
        ),
      );
    }

    /// Riverpod flushes provider changes on frames, and nothing here rebuilds
    /// on its own, so a few frames are pumped before settling.
    Future<void> settle(WidgetTester tester) async {
      for (var i = 0; i < 5; i++) {
        await tester.pump(const Duration(milliseconds: 20));
      }
      await tester.pumpAndSettle();
    }

    Future<void> mount(WidgetTester tester, {Session? signedIn}) async {
      // Made inside the test body: fake async only drives what its own zone
      // schedules. Uses the REAL sessionProvider, signedInUserIdProvider and
      // profileProvider (no overrides on them) so any Riverpod re-entrancy
      // between AccountLanguageSync and profileProvider reproduces here.
      authEvents = StreamController<AuthState>.broadcast();
      addTearDown(authEvents.close);
      activeSession = signedIn;
      await tester.pumpWidget(
        EasyLocalization(
          key: UniqueKey(),
          supportedLocales: const [Locale('en'), Locale('vi')],
          path: 'assets/l10n',
          startLocale: const Locale('en'),
          fallbackLocale: const Locale('en'),
          assetLoader: const FsL10nLoader(),
          child: ProviderScope(
            key: UniqueKey(),
            overrides: [
              authEventsProvider.overrideWithValue(authEvents.stream),
              currentSessionReaderProvider.overrideWithValue(
                () => activeSession,
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

    /// A language row's pick: stored first, the app switched after.
    Future<void> pick(String code) => ProviderScope.containerOf(app)
        .read(languagePickerProvider)
        .save(
          code,
          then: () => EasyLocalization.of(app)!.setLocale(Locale(code)),
        );

    testWidgets('a pick switches the app once the account holds it', (
      tester,
    ) async {
      repaired();
      server.account = 'vi';
      await mount(tester, signedIn: testSession());

      server.hold = Completer<void>();
      unawaited(pick('en'));
      await settle(tester);
      await refetch(tester); // the account still says vi
      expect(appLanguage(), 'vi', reason: 'not switched before it is stored');

      server.hold!.complete();
      await settle(tester);
      expect(server.account, 'en');
      expect(appLanguage(), 'en');
    });

    testWidgets('a pick the account refuses changes nothing', (tester) async {
      repaired();
      server.account = 'vi';
      await mount(tester, signedIn: testSession());

      server.fail = true;
      await expectLater(pick('en'), throwsStateError);
      await settle(tester);

      expect(server.account, 'vi');
      expect(appLanguage(), 'vi');
    });

    testWidgets('an account switch while the keychain answers gets no repair', (
      tester,
    ) async {
      final slow = _SlowStore();
      flags = slow;
      await mount(tester, signedIn: testSession());

      setSession(null);
      await settle(tester);
      setSession(_sessionFor('22222222-2222-2222-2222-222222222222'));
      await settle(tester);
      slow.answer.complete();
      await settle(tester);

      // The phone's pick belonged to the first account: the second is
      // followed, not overwritten.
      expect(server.posts, isEmpty);
      expect(appLanguage(), 'en');
    });

    testWidgets('a return to the app retries a profile that failed to load', (
      tester,
    ) async {
      repaired();
      server.failReads = 1;
      await mount(tester, signedIn: testSession());
      expect(appLanguage(), 'vi', reason: 'nothing to follow yet');

      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await settle(tester);
      expect(appLanguage(), 'en');
    });

    testWidgets('signing back into the same account follows it again', (
      tester,
    ) async {
      repaired();
      server.account = 'vi';
      await mount(tester, signedIn: testSession());

      setSession(null);
      await settle(tester);
      await setAppLanguage(tester, 'en');
      setSession(testSession());
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
      setSession(testSession());
      await settle(tester);

      // The phone's pick may be someone else's: no repair.
      expect(server.posts, isEmpty);
      expect(appLanguage(), 'en');
    });

    testWidgets(
      'cold signed-in launch with async profile fetch does not cancel profileProvider',
      (tester) async {
        // Regression test for PR #627: on a cold signed-in launch,
        // AccountLanguageSync's listener used to call ref.read(profileProvider)
        // synchronously inside Riverpod's FutureHandler.handleFuture callback,
        // cancelling the real GET /api/v1/onboarding/profile future and leaving
        // profileProvider stuck in AsyncLoading(value: null) for the session.
        repaired();
        server.readDelay = const Duration(milliseconds: 50);
        await mount(tester, signedIn: testSession());

        final state = ProviderScope.containerOf(app).read(profileProvider);
        expect(server.reads, 1);
        expect(state.isLoading, isFalse);
        expect(state.hasError, isFalse);
        expect(state.valueOrNull?.preferredLocale, 'en');
        expect(state.valueOrNull?.heightCm, 175.0);
        expect(appLanguage(), 'en');
      },
    );

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
