// The last beat of the first run: it flushes the draft, counts the target up,
// and then has ONE decision to make — Kallo Pro, or straight into the feed.
// Selling Pro to someone who already owns it is the failure this pins.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:kallo_mobile/features/onboarding/data/onboarding_draft.dart';
import 'package:kallo_mobile/features/onboarding/providers/onboarding_draft_providers.dart';
import 'package:kallo_mobile/features/onboarding/screens/welcome_setup_screen.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

import 'onboarding_test_support.dart';

/// Answers the entitlement endpoint and nothing else: the dashboard warm-up is
/// deliberately allowed to fail, since the screen must not depend on it.
class _Api extends ApiClient {
  _Api(this.entitlement);

  /// `null` — the endpoint is unreachable.
  final Map<String, dynamic>? entitlement;

  @override
  Future<T> get<T>(String path) async {
    if (path == '/api/v1/account/entitlements') {
      final value = entitlement;
      if (value == null) {
        throw ApiError('UPSTREAM_UNAVAILABLE', 503, true, 'no entitlements');
      }
      return value as T;
    }
    throw ApiError('UPSTREAM_UNAVAILABLE', 503, true, 'not in this test');
  }
}

Map<String, dynamic> _entitlement({required bool premium}) => {
      'tier': premium ? 'premium' : 'free',
      'purchasesEnabled': true,
      'isLifetime': false,
      'expiresAt': null,
      'willRenew': false,
      'source': null,
      'hasActiveSubscription': premium,
      'trial': {'active': false, 'endsAt': null, 'daysRemaining': 0},
      'features': {
        'ai_analysis': {'allowed': true, 'reason': 'entitled'},
      },
    };

Widget _app(ApiClient api, {required void Function(GoRouter) onRouter}) {
  final router = GoRouter(
    initialLocation: '/welcome',
    routes: [
      GoRoute(path: '/welcome', builder: (_, _) => const WelcomeSetupScreen()),
      GoRoute(path: '/paywall', builder: (_, _) => const SizedBox.shrink()),
      GoRoute(path: '/dashboard', builder: (_, _) => const SizedBox.shrink()),
      GoRoute(path: '/logging', builder: (_, _) => const SizedBox.shrink()),
    ],
  );
  onRouter(router);
  return ProviderScope(
    overrides: [
      apiClientProvider.overrideWithValue(api),
      currentSessionProvider.overrideWith((ref) => testSession()),
      // Nothing on disk to replay, and the in-memory store keeps the flush
      // off the secure-storage platform channel.
      onboardingDraftStoreProvider.overrideWithValue(
        OnboardingDraftStore(storage: InMemoryKeyValueStore()),
      ),
    ],
    child: localizedRouter(router),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() => initOnboardingTest(fonts: false));

  /// Runs the whole finish — the flush, the warm-up window and the decision —
  /// and reports where it landed.
  Future<String> land(WidgetTester tester, ApiClient api) async {
    late GoRouter router;
    await tester.pumpWidget(_app(api, onRouter: (value) => router = value));
    // The post-frame callback, then the window and the warm-up's timeouts.
    await tester.pump();
    await tester.pump(const Duration(seconds: 10));
    await tester.pumpAndSettle();
    return router.state.matchedLocation;
  }

  testWidgets('a free user finishes on Kallo Pro', (tester) async {
    expect(
      await land(tester, _Api(_entitlement(premium: false))),
      '/paywall',
    );
  });

  testWidgets('a user who already has Pro goes straight to the feed',
      (tester) async {
    expect(await land(tester, _Api(_entitlement(premium: true))), '/logging');
  });

  testWidgets('an unreadable entitlement lands in the feed, not the paywall',
      (tester) async {
    // Failing to reach the endpoint is not evidence that a paying customer is
    // on free, and Pro is one tap away from Settings either way.
    expect(await land(tester, _Api(null)), '/logging');
  });
}
