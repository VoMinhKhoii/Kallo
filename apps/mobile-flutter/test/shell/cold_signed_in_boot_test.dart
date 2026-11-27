import 'dart:async';

import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/app.dart';
import 'package:kallo_mobile/features/onboarding/data/onboarding_draft.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_draft_providers.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_providers.dart';
import 'package:kallo_mobile/features/settings/logic/account_language.dart';
import 'package:kallo_mobile/features/settings/screens/settings_screen.dart';
import 'package:kallo_mobile/router.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/services/auth/supabase_service.dart';
import 'package:kallo_mobile/services/http/api_client.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../features/onboarding/onboarding_test_support.dart' show testSession;
import '../l10n_test_loader.dart';

/// Stubs only the HTTP boundary with an async delay so the entire real
/// cold-start provider graph (`KalloApp` → `AccountLanguageSync` →
/// `routerRefreshProvider` → `sessionProvider` → `signedInUserIdProvider` →
/// `profileProvider`) runs unmodified.
class _ColdBootApi extends ApiClient {
  int profileReads = 0;

  @override
  Future<T> get<T>(String path) async {
    await Future<void>.delayed(const Duration(milliseconds: 40));
    if (path == '/api/v1/onboarding/profile') {
      profileReads++;
      return <String, dynamic>{
            'biologicalSex': 'male',
            'age': 25,
            'heightCm': 175,
            'weightKg': 70.0,
            'activityLevel': 'moderate',
            'goal': 'cutting',
            'aggression': '0.5',
            'calorieTarget': 2100,
            'preferredLocale': 'en',
            'onboardingStep': 6,
            'onboardingCompletedAt': '2026-07-01T00:00:00.000Z',
          }
          as T;
    }
    if (path == '/api/v1/groups/profile') {
      return <String, dynamic>{
            'profile': {
              'userId': testSession().user.id,
              'displayName': 'Khoi',
              'handle': 'vmkhoiii',
              'avatarUrl': null,
              'inviteSlug': 'khoi-slug',
              'friendCount': 4,
            },
          }
          as T;
    }
    if (path.startsWith('/api/v1/dashboard')) {
      return <String, dynamic>{
            'profile': null,
            'day': {
              'date': '2026-11-28',
              'meals': <Object?>[],
              'totals': {'calories': 0, 'protein': 0, 'carbs': 0, 'fat': 0},
              'isComplete': false,
              'pendingConfirmations': <Object?>[],
            },
            'weightSummary': {
              'latest': null,
              'delta': null,
              'series': <Object?>[],
            },
            'heatmap': <Object?>[],
          }
          as T;
    }
    if (path.startsWith('/api/v1/logging/day')) {
      return <String, dynamic>{
            'date': '2026-11-28',
            'meals': <Object?>[],
            'totals': {'calories': 0, 'protein': 0, 'carbs': 0, 'fat': 0},
            'isComplete': false,
            'pendingConfirmations': <Object?>[],
          }
          as T;
    }
    if (path.startsWith('/api/v1/billing/entitlements')) {
      return <String, dynamic>{
            'tier': 'free',
            'status': 'none',
            'source': 'none',
            'isActive': false,
          }
          as T;
    }
    return <String, dynamic>{} as T;
  }

  @override
  Future<T> post<T>(String path, [Object? body]) async =>
      <String, dynamic>{} as T;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.flutter.io/shared_preferences'),
          (call) async => call.method == 'getAll' ? <String, Object>{} : true,
        );
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
          (call) async => null,
        );
    await EasyLocalization.ensureInitialized();
    await SupabaseService.initialize(
      url: 'https://example.supabase.co',
      anonKey: 'test-anon-key',
    );
  });

  testWidgets(
    'cold signed-in KalloApp boot resolves profileProvider and populates Settings',
    (tester) async {
      final authEvents = StreamController<AuthState>.broadcast();
      addTearDown(authEvents.close);
      final api = _ColdBootApi();
      final flags =
          InMemoryKeyValueStore()..values[kAccountLanguageRepairedKey] = '1';
      final session = testSession();

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
              // Boundary-only overrides: sessionProvider,
              // signedInUserIdProvider and profileProvider run completely real.
              authEventsProvider.overrideWithValue(authEvents.stream),
              currentSessionReaderProvider.overrideWithValue(() => session),
              apiClientProvider.overrideWithValue(api),
              accountLanguageStorageProvider.overrideWithValue(flags),
              onboardingDraftStoreProvider.overrideWithValue(
                OnboardingDraftStore(storage: InMemoryKeyValueStore()),
              ),
            ],
            child: const KalloApp(),
          ),
        ),
      );

      // Drive past initial frames, microtasks, and the 40ms async HTTP fetch.
      for (var i = 0; i < 6; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }

      final container = ProviderScope.containerOf(
        tester.element(find.byType(KalloApp)),
      );
      final profileState = container.read(profileProvider);
      expect(api.profileReads, 1);
      expect(
        profileState.isLoading,
        isFalse,
        reason: 'profileProvider must not stay stuck in AsyncLoading on boot',
      );
      expect(profileState.hasError, isFalse);
      expect(profileState.valueOrNull?.heightCm, 175.0);
      expect(profileState.valueOrNull?.weightKg, 70.0);
      expect(profileState.valueOrNull?.preferredLocale, 'en');

      // Navigate to Settings and verify the real profile renders (not the
      // blank "Not set" fallback and hidden Preferences section).
      container.read(routerProvider).go('/settings');
      for (var i = 0; i < 6; i++) {
        await tester.pump(const Duration(milliseconds: 50));
      }

      expect(find.byType(SettingsScreen), findsOneWidget);
      expect(find.text('Not set'), findsNothing);
      expect(find.text('Add your body metrics first'), findsNothing);
      expect(find.text('Preferences'), findsOneWidget);
    },
  );
}
