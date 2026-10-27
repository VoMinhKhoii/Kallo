import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:kallo_mobile/features/dashboard/data/dashboard_cache.dart';
import 'package:kallo_mobile/features/dashboard/data/dashboard_providers.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

/// A cold launch used to show a skeleton until `/api/v1/dashboard` answered
/// (after the token refresh, a launch an hour later). Now the last answer for
/// today is shown first and the real fetch replaces it.
const _userId = '11111111-1111-1111-1111-111111111111';
const _date = '2026-10-27';
const _args = (userId: _userId, date: _date);

Session _session() => Session(
  accessToken: 't',
  tokenType: 'bearer',
  user: const User(
    id: _userId,
    appMetadata: {},
    userMetadata: {},
    aud: 'authenticated',
    createdAt: '2026-07-28T00:00:00.000Z',
  ),
);

Map<String, dynamic> _bundleJson(double weight) => {
  'profile': null,
  'day': {'persistedMeals': <dynamic>[]},
  'weightSummary': {
    'range': '30d',
    'weights': <dynamic>[],
    'weightDates': <dynamic>[],
    'currentWeight': weight,
    'todayWeight': null,
    'weightPlaceholder': weight,
    'daysLogged': 0,
    'periodStartWeight': weight,
    'expectedEndWeight': weight,
    'goalDirection': 'down',
    'periodElapsedDays': 0,
    'projectedEndWeight': weight,
    'canProject': false,
  },
  'heatmap': {'cells': <dynamic>[], 'monthHeaders': <dynamic>[]},
};

class _Api extends ApiClient {
  _Api(this.weight);
  double weight;
  var calls = 0;

  @override
  Future<T> get<T>(String path) async {
    calls += 1;
    return _bundleJson(weight) as T;
  }
}

void main() {
  late Directory dir;
  late DashboardCache cache;
  final tz = localTimezoneOffsetMinutes();

  setUp(() async {
    dir = await Directory.systemTemp.createTemp('dashboard-cache-test');
    cache = DashboardCache(directory: () async => dir);
  });
  tearDown(() => dir.delete(recursive: true));

  ProviderContainer containerWith(_Api api) {
    final container = ProviderContainer(
      overrides: [
        apiClientProvider.overrideWithValue(api),
        currentSessionProvider.overrideWith((ref) => _session()),
        dashboardCacheProvider.overrideWithValue(cache),
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  double? weightOf(AsyncValue<DashboardBundle> value) =>
      value.valueOrNull?.weightSummary.currentWeight;

  test('a launch shows the saved day first, then the fetched one', () async {
    await cache.save(_userId, _date, tz, _bundleJson(70));
    final api = _Api(72);
    final container = containerWith(api);
    final seen = <double?>[];
    container.listen(
      dashboardBundleProvider(_args),
      (_, next) => seen.add(weightOf(next)),
      fireImmediately: true,
    );

    await container.read(dashboardBundleProvider(_args).future);
    expect(weightOf(container.read(dashboardBundleProvider(_args))), 70);

    // The rebuild it scheduled fetches the real answer.
    await pumpEventQueue();
    await container.read(dashboardBundleProvider(_args).future);
    expect(weightOf(container.read(dashboardBundleProvider(_args))), 72);
    expect(api.calls, 1);
    expect(seen, containsAllInOrder([70.0, 72.0]));
  });

  test(
    'a later rebuild (a meal logged) never goes back to the saved copy',
    () async {
      await cache.save(_userId, _date, tz, _bundleJson(70));
      final api = _Api(72);
      final container = containerWith(api);
      final sub = container.listen(dashboardBundleProvider(_args), (_, __) {});
      addTearDown(sub.close);
      await container.read(dashboardBundleProvider(_args).future);
      await pumpEventQueue();
      await container.read(dashboardBundleProvider(_args).future);

      api.weight = 73;
      container.invalidate(dashboardBundleProvider(_args));
      final after = await container.read(dashboardBundleProvider(_args).future);

      expect(after.weightSummary.currentWeight, 73);
      expect(api.calls, 2);
    },
  );

  test('each fetch replaces the saved copy', () async {
    final api = _Api(71);
    final container = containerWith(api);
    final sub = container.listen(dashboardBundleProvider(_args), (_, __) {});
    addTearDown(sub.close);
    await container.read(dashboardBundleProvider(_args).future);
    await pumpEventQueue();

    final next = DashboardCache(directory: () async => dir);
    final saved = await next.takeOnce(_userId, _date, tz);
    expect(saved?['weightSummary']['currentWeight'], 71);
  });

  test('another day, another zone or another user finds nothing', () async {
    await cache.save(_userId, _date, tz, _bundleJson(70));
    expect(await cache.takeOnce(_userId, '2026-10-28', tz), isNull);
    expect(await cache.takeOnce(_userId, _date, tz + 60), isNull);
    expect(await cache.takeOnce('someone-else', _date, tz), isNull);
  });

  test('the saved day is served once per session', () async {
    await cache.save(_userId, _date, tz, _bundleJson(70));
    expect(await cache.takeOnce(_userId, _date, tz), isNotNull);
    expect(await cache.takeOnce(_userId, _date, tz), isNull);
  });

  test('clear removes the account\'s saved day', () async {
    await cache.save(_userId, _date, tz, _bundleJson(70));
    await cache.clear(_userId);
    final next = DashboardCache(directory: () async => dir);
    expect(await next.takeOnce(_userId, _date, tz), isNull);
  });

  test('an unreadable disk reads as nothing saved', () async {
    final broken = DashboardCache(
      directory: () async => throw const FileSystemException('denied'),
    );
    await broken.save(_userId, _date, tz, _bundleJson(70));
    expect(await broken.takeOnce(_userId, _date, tz), isNull);
  });
}
