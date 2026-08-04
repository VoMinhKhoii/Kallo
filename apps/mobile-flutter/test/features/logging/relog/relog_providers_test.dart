import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:nham_mobile/data/api_client.dart';
import 'package:nham_mobile/features/logging/data/relog_providers.dart';
import 'package:nham_mobile/models/relog.dart';

/// ApiClient stand-in that records requests and replays canned responses —
/// never touches HTTP or the Supabase session.
class FakeApiClient extends ApiClient {
  final List<(String, String, Object?)> requests = [];
  Object? Function(String method, String path, Object? body)? handler;

  @override
  Future<T> get<T>(String path) async {
    requests.add(('GET', path, null));
    return handler!('GET', path, null) as T;
  }

  @override
  Future<T> post<T>(String path, [Object? body]) async {
    requests.add(('POST', path, body));
    return handler!('POST', path, body) as T;
  }
}

const _candidatesJson = {
  'dishes': [
    {
      'kind': 'dish',
      'sourceMealId': 'meal-1',
      'mealItemOrder': 2,
      'name': 'Phở bò',
      'ingredientCount': 4,
      'occurrenceCount': 7,
      'lastLoggedAt': '2026-07-01T00:00:00.000Z',
      // Drizzle decimals arrive as strings on some columns and numbers on
      // others; both must decode.
      'totalGrams': 450,
      'caloriesKcal': 410.5,
      'proteinG': 20,
      'carbohydrateG': null,
      'fatG': 10,
    },
  ],
  'meals': [
    {
      'kind': 'meal',
      'sourceMealId': 'meal-9',
      'name': 'phở bò với trà đá',
      'dishCount': 2,
      'occurrenceCount': 1,
      'lastLoggedAt': '2026-06-30T00:00:00.000Z',
      'caloriesKcal': 500,
    },
  ],
};

void main() {
  _cacheKeyIdentity();

  late FakeApiClient api;
  late ProviderContainer container;

  setUp(() {
    api = FakeApiClient();
    container = ProviderContainer(
      overrides: [apiClientProvider.overrideWithValue(api)],
    );
    addTearDown(container.dispose);
  });

  group('relogCandidatesProvider', () {
    test(
      'an empty query asks for the ranked staples, with no q param',
      () async {
        api.handler = (_, __, ___) => _candidatesJson;

        await container.read(
          relogCandidatesProvider(
            const RelogCandidatesArgs('user-1', ''),
          ).future,
        );

        expect(
          api.requests.single.$2,
          '/api/v1/meals/relog/candidates?limit=8',
          reason: 'an empty query is not a special case server-side',
        );
      },
    );

    test('encodes a Vietnamese query rather than sending it raw', () async {
      api.handler = (_, __, ___) => _candidatesJson;

      await container.read(
        relogCandidatesProvider(
          const RelogCandidatesArgs('user-1', 'cà phê sữa'),
        ).future,
      );

      final path = api.requests.single.$2;
      expect(path, contains('q=c%C3%A0+ph%C3%AA+s%E1%BB%AFa'));
      expect(path, contains('limit=8'));
    });

    test('trims the query before sending it', () async {
      api.handler = (_, __, ___) => _candidatesJson;

      await container.read(
        relogCandidatesProvider(
          const RelogCandidatesArgs('user-1', '  pho  '),
        ).future,
      );

      expect(api.requests.single.$2, contains('q=pho&'));
    });

    test('decodes both groups, preserving unknown macros as null', () async {
      api.handler = (_, __, ___) => _candidatesJson;

      final result = await container.read(
        relogCandidatesProvider(
          const RelogCandidatesArgs('user-1', 'pho'),
        ).future,
      );

      expect(result.dishes.single.name, 'Phở bò');
      expect(result.dishes.single.mealItemOrder, 2);
      expect(result.dishes.single.partCount, 4);
      expect(result.dishes.single.summary.caloriesKcal, 410.5);
      expect(
        result.dishes.single.summary.carbohydrateG,
        isNull,
        reason: 'unknown is not zero',
      );
      expect(result.meals.single.partCount, 2);
      // Dishes list before meals: the flat option list is what the picker walks.
      expect(result.options.map((c) => c.name), [
        'Phở bò',
        'phở bò với trà đá',
      ]);
    });

    test(
      'a dish candidate stages as a dish ref, a meal as a meal ref',
      () async {
        api.handler = (_, __, ___) => _candidatesJson;

        final result = await container.read(
          relogCandidatesProvider(
            const RelogCandidatesArgs('user-1', 'pho'),
          ).future,
        );

        expect(
          result.dishes.single.ref,
          const RelogDishRef(sourceMealId: 'meal-1', mealItemOrder: 2),
        );
        expect(
          result.meals.single.ref,
          const RelogMealRef(sourceMealId: 'meal-9'),
        );
      },
    );
  });

  group('stageRelogAnalysis', () {
    test(
      'posts references only, with the attempt id, then refreshes the day',
      () async {
        api.handler = (method, path, __) {
          if (method == 'POST') return {'analysisId': 'analysis-1'};
          // The awaited day refresh that follows the stage.
          return <String, dynamic>{'meals': [], 'pendingConfirmations': []};
        };

        await stageRelogAnalysis(
          _Ref(container),
          userId: 'user-1',
          date: '2026-07-02',
          items: const [
            RelogDishRef(sourceMealId: 'meal-1', mealItemOrder: 2),
            RelogMealRef(sourceMealId: 'meal-9'),
          ],
          attemptId: 'attempt-1',
        );

        final post = api.requests.first;
        expect(post.$1, 'POST');
        expect(post.$2, '/api/v1/meals/relog/stage');
        final body = post.$3! as Map<String, dynamic>;
        expect(body['items'], [
          {'kind': 'dish', 'sourceMealId': 'meal-1', 'mealItemOrder': 2},
          {'kind': 'meal', 'sourceMealId': 'meal-9'},
        ]);
        expect(body['loggedDate'], '2026-07-02');
        expect(body['attemptId'], 'attempt-1');
        expect(body.containsKey('timezoneOffset'), isTrue);

        // The staged card is delivered by refetching the day — nothing renders it
        // locally, so a missing refresh means the card never appears.
        expect(
          api.requests.any((r) => r.$2.startsWith('/api/v1/logging/day')),
          isTrue,
          reason: 'the day was not refetched after staging',
        );
      },
    );

    test('always sends an attemptId — the server requires one', () async {
      // Without it the server's (user_id, attempt_id) upsert degenerates into
      // an INSERT per call, since NULLs never conflict.
      api.handler =
          (method, path, __) =>
              method == 'POST'
                  ? {'analysisId': 'a'}
                  : <String, dynamic>{'meals': [], 'pendingConfirmations': []};

      await stageRelogAnalysis(
        _Ref(container),
        userId: 'user-1',
        date: '2026-07-02',
        items: const [RelogMealRef(sourceMealId: 'meal-9')],
        attemptId: 'attempt-9',
      );

      final body = api.requests.first.$3! as Map<String, dynamic>;
      expect(body['attemptId'], 'attempt-9');
    });
  });
}

/// Minimal [WidgetRef] stand-in over a real container: `stageRelogAnalysis`
/// only reads, refreshes and invalidates, so this keeps it a plain unit test
/// rather than dragging in a widget pump.
class _Ref implements WidgetRef {
  _Ref(this._container);
  final ProviderContainer _container;

  @override
  T read<T>(ProviderListenable<T> provider) => _container.read(provider);

  @override
  void invalidate(ProviderOrFamily provider) => _container.invalidate(provider);

  @override
  dynamic noSuchMethod(Invocation invocation) =>
      throw UnsupportedError('not needed by these tests');
}

// The five-minute keep-alive means a signed-out account's meal names, macros
// and source ids can outlive its session. Keyed on the query alone, the next
// account to sign in on this device gets them served from cache without a
// request — the server's ownership checks stop a copy, not a disclosure.
void _cacheKeyIdentity() {
  group('RelogCandidatesArgs', () {
    test('the same query for two accounts is two cache entries', () {
      expect(
        const RelogCandidatesArgs('user-a', 'pho'),
        isNot(const RelogCandidatesArgs('user-b', 'pho')),
      );
      expect(
        const RelogCandidatesArgs('user-a', 'pho').hashCode,
        isNot(const RelogCandidatesArgs('user-b', 'pho').hashCode),
      );
    });

    test('the same account and query is ONE entry, so caching still works', () {
      expect(
        const RelogCandidatesArgs('user-a', 'pho'),
        const RelogCandidatesArgs('user-a', 'pho'),
      );
      expect(
        const RelogCandidatesArgs('user-a', 'pho').hashCode,
        const RelogCandidatesArgs('user-a', 'pho').hashCode,
      );
    });
  });
}
