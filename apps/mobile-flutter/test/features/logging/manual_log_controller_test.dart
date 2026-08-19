import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/services/http/api_client.dart';
import 'package:kallo_mobile/features/logging/data/manual_log_providers.dart';
import 'package:kallo_mobile/models/nutrition/ingredient.dart';

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

const rice = IngredientSearchResult(
  id: 'fct-rice',
  namePrimary: 'Cơm trắng',
  nameEn: 'White rice',
  state: 'cooked',
  per100g: IngredientMacrosPer100g(caloriesKcal: 130, proteinG: 2.7),
);

void main() {
  late FakeApiClient api;
  late ProviderContainer container;

  setUp(() {
    api = FakeApiClient();
    container = ProviderContainer(
      overrides: [apiClientProvider.overrideWithValue(api)],
    );
    addTearDown(container.dispose);
    // manualLogProvider is autoDispose — hold a listener for the test's
    // lifetime so state survives between reads.
    container.listen(manualLogProvider, (_, __) {});
  });

  group('ingredientSearchProvider', () {
    test('hits the search endpoint with an encoded query', () async {
      api.handler =
          (_, __, ___) => <String, dynamic>{
            'results': [
              {
                'id': 'fct-rice',
                'namePrimary': 'Cơm trắng',
                'nameEn': 'White rice',
                'state': 'cooked',
                'per100g': {'caloriesKcal': 130},
              },
            ],
          };

      final results = await container.read(
        ingredientSearchProvider('thịt gà').future,
      );

      expect(results, hasLength(1));
      expect(results.first.namePrimary, 'Cơm trắng');
      // encodeQueryComponent form-encodes the space as '+', which URL query
      // parsing (URLSearchParams / req.nextUrl.searchParams) decodes back.
      expect(
        api.requests.single.$2,
        '/api/v1/ingredients/search?q=th%E1%BB%8Bt+g%C3%A0&limit=10',
      );
    });

    test('empty query requests the recents list', () async {
      api.handler = (_, __, ___) => <String, dynamic>{'results': []};

      await container.read(ingredientSearchProvider('').future);

      expect(api.requests.single.$2, '/api/v1/ingredients/search?limit=10');
    });
  });

  group('ManualLogController', () {
    test('add / update / remove rows drive canSave and totals', () {
      final notifier = container.read(manualLogProvider.notifier);

      notifier.addIngredient(rice);
      var state = container.read(manualLogProvider);
      expect(state.items, hasLength(1));
      // Default 100g — one tap to add, immediately editable.
      expect(state.items.single.grams, 100);
      expect(state.canSave, isTrue);
      expect(state.totals.caloriesKcal, closeTo(130, 1e-9));

      notifier.updateGrams(state.items.single.id, 150);
      state = container.read(manualLogProvider);
      expect(state.totals.caloriesKcal, closeTo(195, 1e-9));

      notifier.updateGrams(state.items.single.id, null);
      state = container.read(manualLogProvider);
      expect(state.canSave, isFalse);

      notifier.removeItem(state.items.single.id);
      expect(container.read(manualLogProvider).items, isEmpty);
    });

    test(
      'save posts complete items to /api/v1/meals/manual and resets',
      () async {
        // save() invalidates the day / meal-dates / dashboard providers, which
        // (re)build and fetch — the handler must answer those too.
        api.handler = (method, path, body) {
          if (path == '/api/v1/meals/manual') {
            return <String, dynamic>{
              'mealId': 'meal-1',
              'meal': <String, dynamic>{},
            };
          }
          if (path.startsWith('/api/v1/meals/dates')) return <dynamic>[];
          return <String, dynamic>{};
        };
        final notifier = container.read(manualLogProvider.notifier);
        notifier.addIngredient(rice);
        notifier.updateGrams(
          container.read(manualLogProvider).items.single.id,
          150,
        );

        await notifier.save(userId: 'user-1', date: '2026-06-12');

        final saves =
            api.requests.where((r) => r.$2 == '/api/v1/meals/manual').toList();
        final (method, path, body) = saves.single;
        expect(method, 'POST');
        final json = body as Map<String, dynamic>;
        expect(json['loggedDate'], '2026-06-12');
        expect(json['mealId'], isNotEmpty);
        expect(json['items'], [
          {'foodCompositionId': 'fct-rice', 'grams': 150},
        ]);
        // Sheet state resets after a successful save.
        expect(container.read(manualLogProvider).items, isEmpty);
        expect(container.read(manualLogProvider).isSaving, isFalse);
      },
    );

    test('save failure keeps the items and clears isSaving', () async {
      api.handler = (_, __, ___) => throw ApiError('INTERNAL', 500, false, 'x');
      final notifier = container.read(manualLogProvider.notifier);
      notifier.addIngredient(rice);

      await expectLater(
        notifier.save(userId: 'user-1', date: '2026-06-12'),
        throwsA(isA<ApiError>()),
      );

      final state = container.read(manualLogProvider);
      expect(state.items, hasLength(1));
      expect(state.isSaving, isFalse);
    });

    test('save with no complete items is a no-op', () async {
      final notifier = container.read(manualLogProvider.notifier);
      notifier.addIngredient(rice);
      notifier.updateGrams(
        container.read(manualLogProvider).items.single.id,
        null,
      );

      await notifier.save(userId: 'user-1', date: '2026-06-12');

      expect(api.requests, isEmpty);
    });
  });
}
