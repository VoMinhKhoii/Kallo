// Entitlement model parsing + post-purchase polling regressions.
//
// The server `/api/v1/account/entitlements` shape drives every gating decision,
// so a parse miss must fail CLOSED (free / AI locked, never over-grant). The
// controller polls the SAME endpoint after a store purchase until the server
// flips to premium — it never self-grants.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nham_mobile/data/api_client.dart';
import 'package:nham_mobile/data/billing/entitlements_provider.dart';

/// ApiClient stand-in: replays a canned entitlements body per GET, counting
/// calls so the polling test can advance the response over time.
typedef ResponseHandler =
    FutureOr<Map<String, dynamic>> Function(int callIndex);

class FakeApiClient extends ApiClient {
  FakeApiClient(this.getHandler, {ResponseHandler? postHandler})
    : postHandler = postHandler ?? getHandler;

  int getCalls = 0;
  int postCalls = 0;
  final ResponseHandler getHandler;
  final ResponseHandler postHandler;

  int get calls => getCalls + postCalls;

  @override
  Future<T> get<T>(String path) async {
    final index = getCalls;
    getCalls += 1;
    final body = await getHandler(index);
    return body as T;
  }

  @override
  Future<T> post<T>(String path, [Object? body]) async {
    final index = postCalls;
    postCalls += 1;
    final response = await postHandler(index);
    return response as T;
  }
}

const userA = '11111111-1111-1111-1111-111111111111';
const userB = '22222222-2222-2222-2222-222222222222';

final testUserIdProvider = StateProvider<String?>((ref) => userA);

Map<String, dynamic> freeJson({String? source}) => {
  'tier': 'free',
  'isLifetime': false,
  'willRenew': false,
  'source': source,
  'hasActiveSubscription': false,
  'trial': {'active': false, 'endsAt': null, 'daysRemaining': 0},
  'features': {
    'ai_analysis': {'allowed': false, 'reason': 'not_entitled'},
  },
};

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
  'hasActiveSubscription': !lifetime,
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
        'purchasesEnabled': true,
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

    test('paid subscription wins when a trial window is also active', () {
      final e = EntitlementState.fromJson({
        ...premiumJson(),
        'hasActiveSubscription': true,
        'trial': {
          'active': true,
          'endsAt': '2026-07-19T00:00:00.000Z',
          'daysRemaining': 5,
        },
      });

      expect(e.isPremium, isTrue);
      expect(e.trial.active, isTrue);
      expect(e.isTrialing, isFalse);
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
        overrides: [
          apiClientProvider.overrideWithValue(api),
          entitlementsUserIdProvider.overrideWith(
            (ref) => ref.watch(testUserIdProvider),
          ),
        ],
      );
      c.listen(entitlementsProvider(userA), (_, _) {}, fireImmediately: true);
      addTearDown(c.dispose);
      return c;
    }

    test(
      'returns true immediately when the server is already premium',
      () async {
        final api = FakeApiClient(
          (_) => freeJson(),
          postHandler: (_) => premiumJson(),
        );
        final c = makeContainer(api);
        // Resolve the initial build first.
        await c.read(entitlementsProvider(userA).future);

        final premium = await c
            .read(entitlementsProvider(userA).notifier)
            .pollUntilPremium(
              interval: const Duration(milliseconds: 1),
              timeout: const Duration(milliseconds: 50),
            );

        expect(premium, isTrue);
        expect(api.getCalls, 1);
        expect(api.postCalls, 1);
      },
    );

    test('reconciles once, then polls local state until premium', () async {
      final api = FakeApiClient(
        (i) => i >= 2 ? premiumJson() : freeJson(),
        postHandler: (_) => freeJson(),
      );
      final c = makeContainer(api);
      await c.read(entitlementsProvider(userA).future); // initial GET

      final premium = await c
          .read(entitlementsProvider(userA).notifier)
          .pollUntilPremium(
            interval: const Duration(milliseconds: 1),
            timeout: const Duration(seconds: 2),
          );

      expect(premium, isTrue);
      expect(api.postCalls, 1);
      expect(api.getCalls, 3);
      expect(
        c.read(entitlementsProvider(userA)).valueOrNull?.isPremium,
        isTrue,
      );
    });

    test('returns false when the window elapses without a flip', () async {
      final api = FakeApiClient((_) => freeJson());
      final c = makeContainer(api);
      await c.read(entitlementsProvider(userA).future);

      final premium = await c
          .read(entitlementsProvider(userA).notifier)
          .pollUntilPremium(
            interval: const Duration(milliseconds: 5),
            timeout: const Duration(milliseconds: 30),
          );

      expect(premium, isFalse);
      expect(api.postCalls, 1);
      expect(api.getCalls, greaterThan(1));
    });
  });

  group('EntitlementsController account isolation', () {
    test(
      'reconcile stays alive while an unobserved caller awaits the response',
      () async {
        final reconcileResponse = Completer<Map<String, dynamic>>();
        final api = FakeApiClient(
          (_) => freeJson(),
          postHandler: (_) => reconcileResponse.future,
        );
        final c = ProviderContainer(
          overrides: [
            apiClientProvider.overrideWithValue(api),
            entitlementsUserIdProvider.overrideWith(
              (ref) => ref.watch(testUserIdProvider),
            ),
          ],
        );
        addTearDown(c.dispose);

        final reconcile =
            c.read(entitlementsProvider(userA).notifier).reconcile();
        await c.pump();
        reconcileResponse.complete({...freeJson(), 'purchasesEnabled': true});

        final snapshot = await reconcile;

        expect(snapshot?.purchasesEnabled, isTrue);
        expect(api.postCalls, 1);
      },
    );

    test(
      'post-purchase polling stays alive without a provider subscription',
      () async {
        final reconcileResponse = Completer<Map<String, dynamic>>();
        final api = FakeApiClient(
          (_) => freeJson(),
          postHandler: (_) => reconcileResponse.future,
        );
        final c = ProviderContainer(
          overrides: [
            apiClientProvider.overrideWithValue(api),
            entitlementsUserIdProvider.overrideWith(
              (ref) => ref.watch(testUserIdProvider),
            ),
          ],
        );
        addTearDown(c.dispose);

        final poll = c
            .read(entitlementsProvider(userA).notifier)
            .pollUntilPremium(
              interval: const Duration(milliseconds: 1),
              timeout: const Duration(milliseconds: 50),
            );
        await c.pump();
        reconcileResponse.complete(premiumJson());

        expect(await poll, isTrue);
        expect(api.postCalls, 1);
      },
    );

    test(
      'account switch does not expose the previous account snapshot',
      () async {
        final api = FakeApiClient(
          (index) => index == 0 ? premiumJson() : freeJson(source: 'account_b'),
        );
        final c = ProviderContainer(
          overrides: [
            apiClientProvider.overrideWithValue(api),
            entitlementsUserIdProvider.overrideWith(
              (ref) => ref.watch(testUserIdProvider),
            ),
          ],
        );
        addTearDown(c.dispose);

        final accountA = await c.read(entitlementsProvider(userA).future);
        expect(accountA.isPremium, isTrue);

        c.read(testUserIdProvider.notifier).state = userB;
        final accountBAsync = c.read(entitlementsProvider(userB));
        expect(accountBAsync.valueOrNull?.isPremium ?? false, isFalse);

        final accountB = await c.read(entitlementsProvider(userB).future);
        expect(accountB.isPremium, isFalse);
        expect(accountB.source, 'account_b');
      },
    );

    test(
      'stale reconcile completion is ignored after account switch',
      () async {
        final staleReconcile = Completer<Map<String, dynamic>>();
        final api = FakeApiClient(
          (index) => freeJson(source: index == 0 ? 'account_a' : 'account_b'),
          postHandler: (_) => staleReconcile.future,
        );
        final c = ProviderContainer(
          overrides: [
            apiClientProvider.overrideWithValue(api),
            entitlementsUserIdProvider.overrideWith(
              (ref) => ref.watch(testUserIdProvider),
            ),
          ],
        );
        addTearDown(c.dispose);

        await c.read(entitlementsProvider(userA).future);
        final reconcile =
            c.read(entitlementsProvider(userA).notifier).reconcile();
        await Future<void>.delayed(Duration.zero);

        c.read(testUserIdProvider.notifier).state = userB;
        final accountB = await c.read(entitlementsProvider(userB).future);
        expect(accountB.source, 'account_b');

        staleReconcile.complete(premiumJson());
        expect(await reconcile, isNull);
        expect(
          c.read(entitlementsProvider(userB)).valueOrNull?.source,
          'account_b',
        );
      },
    );
  });
}
