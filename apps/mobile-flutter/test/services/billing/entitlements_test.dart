// Entitlement model parsing + post-purchase polling regressions.
//
// The server `/api/v1/account/entitlements` shape drives every gating decision,
// so a parse miss must fail CLOSED (free / AI locked, never over-grant). The
// controller polls the SAME endpoint after a store purchase until the server
// flips to premium — it never self-grants.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/services/http/api_client.dart';
import 'package:kallo_mobile/services/billing/entitlement_state.dart';
import 'package:kallo_mobile/services/billing/entitlements_provider.dart';

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
      expect(e.reconciliationRequired, isFalse);
    });

    test('parses the server reconciliation recovery hint', () {
      final e = EntitlementState.fromJson({
        ...freeJson(),
        'reconciliationRequired': true,
      });

      expect(e.reconciliationRequired, isTrue);
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
        'tier': 'free',
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
      expect(e.reconciliationRequired, isFalse);
      expect(e.trial.active, isFalse);
      expect(e.trial.daysRemaining, 0);
      expect(e.aiAnalysis.allowed, isFalse);
      expect(e.aiAnalysis.reason, FeatureReason.notEntitled);
    });

    test('empty / malformed date strings parse to null', () {
      final e = EntitlementState.fromJson(premiumJson(expiresAt: ''));
      expect(e.expiresAt, isNull);
    });

    test('parses the whole feature map, not just ai_analysis', () {
      final e = EntitlementState.fromJson({
        ...freeJson(),
        'enforcementEnabled': true,
        'features': {
          'ai_analysis': {'allowed': false, 'reason': 'trial_expired'},
          'label_scan': {'allowed': false, 'reason': 'not_entitled'},
          'micronutrients': {'allowed': true, 'reason': 'trial'},
          'relog': {'allowed': false, 'reason': 'not_entitled'},
          'cheat_meal': {'allowed': false, 'reason': 'not_entitled'},
          'copy_split': {'allowed': false, 'reason': 'not_entitled'},
          'unlimited_circle': {'allowed': false, 'reason': 'not_entitled'},
        },
      });
      expect(e.features.length, 7);
      expect(e.aiAnalysis.reason, FeatureReason.trialExpired);
      expect(e.featureAccess(PremiumFeature.labelScan).allowed, isFalse);
      expect(e.featureAccess(PremiumFeature.micronutrients).allowed, isTrue);
      expect(
        e.featureAccess(PremiumFeature.micronutrients).reason,
        FeatureReason.trial,
      );
      // Unknown names read denied rather than throwing or over-granting.
      expect(e.featureAccess('not_a_feature').allowed, isFalse);
    });

    test('malformed feature entries are dropped, not fabricated', () {
      final e = EntitlementState.fromJson({
        ...freeJson(),
        'features': {
          'relog': 'nope',
          'label_scan': {'allowed': true, 'reason': 'entitled'},
        },
      });
      expect(e.features.keys, ['label_scan']);
      expect(e.featureAccess(PremiumFeature.relog).allowed, isFalse);
    });

    test('a payload without enforcementEnabled defaults it off', () {
      // Backwards compatibility: an old server never sent the flag, and a
      // missing flag must not paint locks over a working app.
      final e = EntitlementState.fromJson(freeJson());
      expect(e.enforcementEnabled, isFalse);
      expect(e.showsLockFor(PremiumFeature.labelScan), isFalse);
    });

    test('showsLockFor is suppressed while enforcement is off', () {
      final locked = {
        ...freeJson(),
        'features': {
          'label_scan': {'allowed': false, 'reason': 'not_entitled'},
        },
      };
      expect(
        EntitlementState.fromJson(locked).showsLockFor(
          PremiumFeature.labelScan,
        ),
        isFalse,
      );
      expect(
        EntitlementState.fromJson({
          ...locked,
          'enforcementEnabled': true,
        }).showsLockFor(PremiumFeature.labelScan),
        isTrue,
      );
    });

    test('the conservative fallback locks every feature', () {
      const e = EntitlementState.free;
      expect(e.features, isEmpty);
      expect(e.enforcementEnabled, isFalse);
      expect(e.aiAnalysis.allowed, isFalse);
      expect(e.featureAccess(PremiumFeature.unlimitedCircle).allowed, isFalse);
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
              // Generous: the poll finishes in a few 1ms ticks, but under full-suite
              // isolate contention a tight wall-clock window flakes (seen at 50ms).
              timeout: const Duration(seconds: 2),
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

    test(
      'preserves the last snapshot during a transient poll failure',
      () async {
        final recovery = Completer<Map<String, dynamic>>();
        final api = FakeApiClient((index) {
          if (index == 0) return freeJson();
          if (index == 1) throw StateError('transient poll failure');
          return recovery.future;
        }, postHandler: (_) => freeJson());
        final c = makeContainer(api);
        await c.read(entitlementsProvider(userA).future);

        final poll = c
            .read(entitlementsProvider(userA).notifier)
            .pollUntilPremium(
              interval: const Duration(milliseconds: 1),
              timeout: const Duration(seconds: 2),
            );
        while (api.getCalls < 3) {
          await Future<void>.delayed(const Duration(milliseconds: 1));
        }

        final preserved = c.read(entitlementsProvider(userA));
        expect(preserved, isA<AsyncData<EntitlementState>>());
        expect(preserved.valueOrNull?.isPremium, isFalse);

        recovery.complete(premiumJson());
        expect(await poll, isTrue);
        expect(
          c.read(entitlementsProvider(userA)).valueOrNull?.isPremium,
          isTrue,
        );
      },
    );

    test(
      'does not confirm cached premium after transient reconcile failure',
      () async {
        final api = FakeApiClient(
          (index) => index == 0 ? premiumJson() : freeJson(),
          postHandler: (_) => throw StateError('transient reconcile failure'),
        );
        final c = makeContainer(api);
        final initial = await c.read(entitlementsProvider(userA).future);
        expect(initial.isPremium, isTrue);

        final premium = await c
            .read(entitlementsProvider(userA).notifier)
            .pollUntilPremium(
              interval: const Duration(milliseconds: 1),
              timeout: const Duration(milliseconds: 20),
            );

        expect(premium, isFalse);
        // Both provider attempts fail; neither may resurrect the cached
        // premium snapshot. The count is the bound, not the behaviour.
        expect(api.postCalls, 2);
        expect(api.getCalls, greaterThan(1));
        expect(
          c.read(entitlementsProvider(userA)).valueOrNull?.isPremium,
          isFalse,
        );
      },
    );

    test('bounds a hung reconcile by the polling deadline', () async {
      final hungReconcile = Completer<Map<String, dynamic>>();
      final api = FakeApiClient(
        (_) => freeJson(),
        postHandler: (_) => hungReconcile.future,
      );
      final c = makeContainer(api);
      await c.read(entitlementsProvider(userA).future);
      final stopwatch = Stopwatch()..start();

      const interval = Duration(milliseconds: 1);
      const timeout = Duration(milliseconds: 20);
      final premium = await c
          .read(entitlementsProvider(userA).notifier)
          .pollUntilPremium(interval: interval, timeout: timeout);
      stopwatch.stop();

      expect(premium, isFalse);
      expect(stopwatch.elapsed, lessThan(const Duration(milliseconds: 500)));
      // At most two, not exactly one: `pollUntilPremium` reconciles twice by
      // design, and whether the second one fires here is a scheduling detail.
      // The hung reconcile is supposed to eat the whole 20ms budget, leaving
      // nothing for the retry window — but on a loaded machine it returns a
      // sliver early, the window opens, and a second POST goes out legitimately.
      // Pinning 1 pinned the fast-machine outcome; 2 is the documented ceiling
      // and is what "does not spin on a hung reconcile" actually means.
      // Floor as well as ceiling: the first reconcile is not optional, and a
      // bare `lessThanOrEqualTo(2)` would also pass if none had fired at all.
      expect(api.postCalls, greaterThanOrEqualTo(1));
      expect(api.postCalls, lessThanOrEqualTo(2));
      // The cold fetch, plus whatever local reads the leftover window bought.
      // `getCalls == 1` was the same fast-machine pin `postCalls` used to be:
      // when the hung reconcile hands back a sliver of budget, the loop spends
      // it on a local read — which is precisely what the design says the window
      // is FOR ("everything between is a local entitlement read so a slow
      // webhook does not amplify into repeated RevenueCat API calls").
      //
      // The ceiling is derived, not guessed. A leftover at or above the retry
      // floor (timeout/4) is spent on the second RECONCILE, which is hung too
      // and eats the rest — so pure local reads only happen inside a sub-floor
      // sliver, which holds at most `timeout/4 ~/ interval` of them. A poll
      // that actually spun on the hung reconcile would run the whole window at
      // `interval` and land near 21, well outside this.
      final localReadCeiling =
          1 + (timeout ~/ 4).inMilliseconds ~/ interval.inMilliseconds;
      expect(api.getCalls, greaterThanOrEqualTo(1));
      expect(api.getCalls, lessThanOrEqualTo(localReadCeiling));
      expect(
        c.read(entitlementsProvider(userA)).valueOrNull?.isPremium,
        isFalse,
      );

      hungReconcile.complete(premiumJson());
      await c.pump();
      expect(
        c.read(entitlementsProvider(userA)).valueOrNull?.isPremium,
        isFalse,
      );
    });

    test('returns false when the window elapses without a flip', () async {
      final api = FakeApiClient((_) => freeJson());
      final c = makeContainer(api);
      await c.read(entitlementsProvider(userA).future);

      final premium = await c
          .read(entitlementsProvider(userA).notifier)
          .pollUntilPremium(
            // Wide enough that the mid-window reconcile reliably lands even
            // under full-suite isolate contention (at 30ms this flaked —
            // a stalled isolate could miss or double the mid-window post).
            interval: const Duration(milliseconds: 10),
            timeout: const Duration(milliseconds: 300),
          );

      expect(premium, isFalse);
      // Two provider calls, never more: one immediately after the store call
      // and one mid-window. The rest of the window is cheap local reads.
      expect(api.postCalls, 2);
      expect(api.getCalls, greaterThan(1));
    });

    test('retries the provider when the purchase lands after the first '
        'reconcile', () async {
      // The observed failure: the first reconcile ran before the provider had
      // recorded the purchase, so it correctly found nothing. Local reads can
      // never discover a grant the server does not have, so without a second
      // provider call activation depends entirely on the webhook.
      final api = FakeApiClient(
        (_) => freeJson(),
        postHandler: (index) => index == 0 ? freeJson() : premiumJson(),
      );
      final c = makeContainer(api);
      await c.read(entitlementsProvider(userA).future);

      final premium = await c
          .read(entitlementsProvider(userA).notifier)
          .pollUntilPremium(
            interval: const Duration(milliseconds: 5),
            // Generous: the poll finishes in a few 1ms ticks, but under full-suite
            // isolate contention a tight wall-clock window flakes (seen at 50ms).
            timeout: const Duration(seconds: 2),
          );

      expect(premium, isTrue);
      expect(api.postCalls, 2);
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
              // Generous: the poll finishes in a few 1ms ticks, but under full-suite
              // isolate contention a tight wall-clock window flakes (seen at 50ms).
              timeout: const Duration(seconds: 2),
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
