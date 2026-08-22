import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/services/http/api_client.dart';
import 'package:kallo_mobile/features/logging/data/barcode_providers.dart';

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

const productJson = <String, dynamic>{
  'barcode': '8934563138162',
  'name': 'Hảo Hảo',
  'brand': 'Acecook',
  'caloriesKcal': 350,
  'proteinG': 7.5,
  'carbohydrateG': 52,
  'fatG': 12,
  'servingSizeG': 75,
  'packageSizeG': 150,
};

void main() {
  late FakeApiClient api;
  late ProviderContainer container;

  setUp(() {
    api = FakeApiClient();
    container = ProviderContainer(
      overrides: [apiClientProvider.overrideWithValue(api)],
    );
    addTearDown(container.dispose);
    // barcodeFlowProvider is autoDispose — hold a listener for the test's
    // lifetime so state survives between reads.
    container.listen(barcodeFlowProvider, (_, __) {});
  });

  BarcodeFlowController notifier() =>
      container.read(barcodeFlowProvider.notifier);
  BarcodeFlowState state() => container.read(barcodeFlowProvider);

  group('search', () {
    test('strips non-digits, hits the endpoint, lands on product', () async {
      api.handler = (_, __, ___) => <String, dynamic>{'product': productJson};

      await notifier().search(' 8934563-138162 ');

      expect(
        api.requests.single.$2,
        '/api/v1/barcode/search?code=8934563138162',
      );
      final s = state();
      expect(s.phase, BarcodeFlowPhase.product);
      expect(s.product?.name, 'Hảo Hảo');
      expect(s.product?.servingSizeG, 75);
      expect(s.lastBarcode, '8934563138162');
      expect(s.errorKey, isNull);
    });

    test('all-garbage input errors locally without a round trip', () async {
      await notifier().search('abc!');

      expect(api.requests, isEmpty);
      expect(state().errorKey, 'logging.barcode.error.invalidInput');
    });

    test('BARCODE_NOT_FOUND maps to the notFound key, back on scanning', () async {
      api.handler =
          (_, __, ___) =>
              throw ApiError('BARCODE_NOT_FOUND', 404, false, 'not found');

      await notifier().search('0000000000000');

      final s = state();
      expect(s.phase, BarcodeFlowPhase.scanning);
      expect(s.errorKey, 'logging.barcode.error.notFound');
      expect(s.isNotFound, isTrue);
    });

    test('unknown errors map to the generic server key', () async {
      api.handler = (_, __, ___) => throw ApiError('INTERNAL', 500, true, 'x');

      await notifier().search('123');

      expect(state().errorKey, 'logging.barcode.error.serverError');
      expect(state().isNotFound, isFalse);
    });

    test('single-flight: a second search while one is in flight is dropped', () async {
      api.handler = (_, __, ___) => <String, dynamic>{'product': productJson};

      // search() flips state to `searching` synchronously (before its first
      // await), so a burst of decode callbacks hits the guard.
      final first = notifier().search('111');
      final second = notifier().search('222');
      await Future.wait([first, second]);

      expect(api.requests.single.$2, '/api/v1/barcode/search?code=111');
    });
  });

  group('logMeal', () {
    Future<void> landOnProduct() async {
      api.handler = (_, __, ___) => <String, dynamic>{'product': productJson};
      await notifier().search('8934563138162');
      api.requests.clear();
    }

    test('posts barcode/grams/date and invalidates surfaces on success', () async {
      await landOnProduct();
      api.handler = (method, path, body) {
        if (path == '/api/v1/barcode/log') {
          return <String, dynamic>{'mealId': 'meal-1'};
        }
        // invalidated surfaces refetch — answer them all.
        if (path.startsWith('/api/v1/meals/dates')) return <dynamic>[];
        return <String, dynamic>{};
      };

      final ok = await notifier().logMeal(
        userId: 'user-1',
        date: '2026-07-02',
        grams: 150,
      );

      expect(ok, isTrue);
      final (method, path, body) =
          api.requests.where((r) => r.$2 == '/api/v1/barcode/log').single;
      expect(method, 'POST');
      final json = body as Map<String, dynamic>;
      expect(json['barcode'], '8934563138162');
      expect(json['grams'], 150);
      expect(json['loggedDate'], '2026-07-02');
      expect(json['mealId'], isNotEmpty);
      expect(json['timezoneOffset'], isA<int>());
    });

    test('failure keeps the quantity step and the product', () async {
      await landOnProduct();
      api.handler = (_, __, ___) => throw ApiError('INTERNAL', 500, true, 'x');

      final ok = await notifier().logMeal(
        userId: 'user-1',
        date: '2026-07-02',
        grams: 150,
      );

      expect(ok, isFalse);
      final s = state();
      expect(s.phase, BarcodeFlowPhase.product);
      expect(s.product, isNotNull);
      expect(s.errorKey, 'logging.barcode.error.serverError');
    });

    test('not_cached sends the user back to the scanner', () async {
      await landOnProduct();
      api.handler =
          (_, __, ___) =>
              throw ApiError('BARCODE_NOT_CACHED', 404, false, 'rescan');

      final ok = await notifier().logMeal(
        userId: 'user-1',
        date: '2026-07-02',
        grams: 150,
      );

      expect(ok, isFalse);
      expect(state().phase, BarcodeFlowPhase.scanning);
      expect(state().errorKey, 'logging.barcode.error.notCached');
    });

    test('without a product it is a no-op', () async {
      final ok = await notifier().logMeal(
        userId: 'user-1',
        date: '2026-07-02',
        grams: 100,
      );
      expect(ok, isFalse);
      expect(api.requests, isEmpty);
    });
  });

  group('phase transitions', () {
    test('scanAgain clears error and product', () async {
      api.handler =
          (_, __, ___) => throw ApiError('BARCODE_NOT_FOUND', 404, false, 'x');
      await notifier().search('123');
      expect(state().errorKey, isNotNull);

      notifier().scanAgain();

      final s = state();
      expect(s.phase, BarcodeFlowPhase.scanning);
      expect(s.errorKey, isNull);
      expect(s.product, isNull);
    });

    test('enterManualMode switches phase and clears error', () async {
      api.handler =
          (_, __, ___) => throw ApiError('BARCODE_NOT_FOUND', 404, false, 'x');
      await notifier().search('123');

      notifier().enterManualMode();

      expect(state().phase, BarcodeFlowPhase.manualEntry);
      expect(state().errorKey, isNull);
    });
  });
}
