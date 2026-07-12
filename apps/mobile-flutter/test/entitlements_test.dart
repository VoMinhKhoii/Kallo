// Entitlement model parsing + post-purchase polling regressions.
//
// The server `/api/v1/account/entitlements` shape drives every gating decision,
// so a parse miss must fail CLOSED (free / AI locked, never over-grant). The
// controller polls the SAME endpoint after a store purchase until the server
// flips to premium — it never self-grants.
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nham_mobile/data/api_client.dart';
import 'package:nham_mobile/data/billing/entitlements_provider.dart';

/// ApiClient stand-in: replays a canned entitlements body per GET, counting
/// calls so the polling test can advance the response over time.
class FakeApiClient extends ApiClient {
  FakeApiClient(this.handler);

  int gets = 0;
  Map<String, dynamic> Function(int callIndex) handler;

  @override
  Future<T> get<T>(String path) async {
    final body = handler(gets);
    gets += 1;
    return body as T;
  }
}

Map<String, dynamic> premiumJson({
  bool lifetime = false,
  bool willRenew = true,
  String? expiresAt = '2026-08-01T00:00:00.000Z',
}) => {
  'tier': 'premium',
  'isLifetime': lifetime,
  'expiresAt': expiresAt,
  'willRenew': willRenew,
  'source': 'app_store',
  'trial': {'active': false, 'endsAt': null, 'daysRemaining': 0},
  'features': {
    'ai_analysis': {'allowed': true, 'reason': 'entitled'},
  },
};

void main() {
  group('EntitlementState.fromJson', () {
    test('parses a premium subscription with a DateTime expiry', () {
      final e = EntitlementState.fromJson(premiumJson());
      expect(e.tier, EntitlementTier.premium);
      expect(e.isPremium, isTrue);
      expect(e.isLifetime, isFalse);
      expect(e.willRenew, isTrue);
      expect(e.source, 'app_store');
      expect(e.expiresAt, DateTime.utc(2026, 8, 1));
      expect(e.aiAnalysis.allowed, isTrue);
      expect(e.aiAnalysis.reason, FeatureReason.entitled);
    });

    test('parses lifetime (no expiry)', () {
      final e = EntitlementState.fromJson(
        premiumJson(lifetime: true, expiresAt: null),
      );
      expect(e.isLifetime, isTrue);
      expect(e.expiresAt, isNull);
    });

    test('parses an active trial with days remaining', () {
      final e = EntitlementState.fromJson({
        'tier': 'premium',
        'isLifetime': false,
        'expiresAt': null,
        'willRenew': false,
        'source': 'trial',
        'trial': {
          'active': true,
          'endsAt': '2026-07-19T00:00:00.000Z',
          'daysRemaining': 5,
        },
        'features': {
          'ai_analysis': {'allowed': true, 'reason': 'trial'},
        },
      });
      expect(e.isTrialing, isTrue);
      expect(e.trial.active, isTrue);
      expect(e.trial.daysRemaining, 5);
      expect(e.trial.endsAt, DateTime.utc(2026, 7, 19));
      expect(e.aiAnalysis.reason, FeatureReason.trial);
    });

    test('maps trial_expired reason on a free tier', () {
      final e = EntitlementState.fromJson({
        'tier': 'free',
        'isLifetime': false,
        'expiresAt': null,
        'willRenew': false,
        'source': null,
        'trial': {'active': false, 'endsAt': null, 'daysRemaining': 0},
        'features': {
          'ai_analysis': {'allowed': false, 'reason': 'trial_expired'},
        },
      });
      expect(e.isPremium, isFalse);
      expect(e.aiAnalysis.allowed, isFalse);
      expect(e.aiAnalysis.reason, FeatureReason.trialExpired);
    });

    test('fails CLOSED on unknown / missing fields (never over-grants)', () {
      final e = EntitlementState.fromJson({
        'tier': 'enterprise', // unknown → free
        'trial': null,
        'features': null,
      });
      expect(e.tier, EntitlementTier.free);
      expect(e.isPremium, isFalse);
      expect(e.isLifetime, isFalse);
      expect(e.willRenew, isFalse);
      expect(e.trial.active, isFalse);
      expect(e.trial.daysRemaining, 0);
      expect(e.aiAnalysis.allowed, isFalse);
      expect(e.aiAnalysis.reason, FeatureReason.notEntitled);
    });

    test('empty / malformed date strings parse to null', () {
      final e = EntitlementState.fromJson(premiumJson(expiresAt: ''));
      expect(e.expiresAt, isNull);
    });
  });

  group('EntitlementsController.pollUntilPremium', () {
    ProviderContainer makeContainer(FakeApiClient api) {
      final c = ProviderContainer(
        overrides: [apiClientProvider.overrideWithValue(api)],
      );
      addTearDown(c.dispose);
      return c;
    }

    test(
      'returns true immediately when the server is already premium',
      () async {
        final api = FakeApiClient((_) => premiumJson());
        final c = makeContainer(api);
        // Resolve the initial build first.
        await c.read(entitlementsProvider.future);
        final callsBefore = api.gets;

        final premium = await c
            .read(entitlementsProvider.notifier)
            .pollUntilPremium(
              interval: const Duration(milliseconds: 1),
              timeout: const Duration(milliseconds: 50),
            );

        expect(premium, isTrue);
        // One poll was enough — it didn't spin the full window.
        expect(api.gets, callsBefore + 1);
      },
    );

    test('polls until the server flips free → premium', () async {
      // Free for the first two polls, premium from the third.
      final api = FakeApiClient(
        (i) =>
            i >= 3
                ? premiumJson()
                : {
                  'tier': 'free',
                  'isLifetime': false,
                  'trial': {'active': false, 'daysRemaining': 0},
                  'features': {
                    'ai_analysis': {'allowed': false, 'reason': 'not_entitled'},
                  },
                },
      );
      final c = makeContainer(api);
      await c.read(entitlementsProvider.future); // initial build = call 0

      final premium = await c
          .read(entitlementsProvider.notifier)
          .pollUntilPremium(
            interval: const Duration(milliseconds: 1),
            timeout: const Duration(seconds: 2),
          );

      expect(premium, isTrue);
      expect(c.read(entitlementsProvider).valueOrNull?.isPremium, isTrue);
    });

    test('returns false when the window elapses without a flip', () async {
      final api = FakeApiClient(
        (_) => {
          'tier': 'free',
          'isLifetime': false,
          'trial': {'active': false, 'daysRemaining': 0},
          'features': {
            'ai_analysis': {'allowed': false, 'reason': 'not_entitled'},
          },
        },
      );
      final c = makeContainer(api);
      await c.read(entitlementsProvider.future);

      final premium = await c
          .read(entitlementsProvider.notifier)
          .pollUntilPremium(
            interval: const Duration(milliseconds: 5),
            timeout: const Duration(milliseconds: 30),
          );

      expect(premium, isFalse);
      // It kept polling (more than the single initial build).
      expect(api.gets, greaterThan(1));
    });
  });
}
