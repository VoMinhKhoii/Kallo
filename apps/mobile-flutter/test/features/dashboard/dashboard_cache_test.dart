import 'dart:async';
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

DashboardBundle _bundleJsonBundle() => DashboardBundle.fromJson(_bundleJson(0));

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
    DashboardCache.resetSession();
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

    DashboardCache.resetSession();
    final saved = await cache.takeOnce(_userId, _date, tz);
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
    expect(await cache.takeOnce(_userId, _date, tz), isNull);
  });

  test('a write this session (a meal, the onboarding finish) skips the saved '
      'day, so the read right after it sees the write', () async {
    await cache.save(_userId, _date, tz, _bundleJson(70));
    DashboardCache.forget(_userId);
    final api = _Api(75);
    final container = containerWith(api);

    final bundle = await container.read(dashboardBundleProvider(_args).future);

    expect(bundle.weightSummary.currentWeight, 75);
    expect(api.calls, 1);
  });

  test('a build superseded by an account change saves nothing', () async {
    final session = StateProvider<Session?>((ref) => _session());
    final api = _Api(80);
    final container = ProviderContainer(
      overrides: [
        apiClientProvider.overrideWithValue(api),
        currentSessionProvider.overrideWith((ref) => ref.watch(session)),
        dashboardCacheProvider.overrideWithValue(cache),
      ],
    );
    addTearDown(container.dispose);
    final sub = container.listen(dashboardBundleProvider(_args), (_, __) {});
    addTearDown(sub.close);
    final pending = container.read(dashboardBundleProvider(_args).future);

    // Signed out while the request is in flight.
    container.read(session.notifier).state = null;
    await container.pump();
    await pending.catchError((_) => _bundleJsonBundle());
    await pumpEventQueue();

    DashboardCache.resetSession();
    expect(await cache.takeOnce(_userId, _date, tz), isNull);
  });

  test(
    'a save already under way at sign-out cannot outlive the clear',
    () async {
      // The directory lookup stalls, as a slow disk would, so the save is still
      // in flight when sign-out clears the file.
      final gate = Completer<void>();
      final slow = DashboardCache(
        directory: () async {
          await gate.future;
          return dir;
        },
      );
      final saving = slow.save(_userId, _date, tz, _bundleJson(70));
      final clearing = slow.clear(_userId);
      gate.complete();
      await Future.wait([saving, clearing]);

      DashboardCache.resetSession();
      expect(await cache.takeOnce(_userId, _date, tz), isNull);
    },
  );

  test('an unreadable disk reads as nothing saved', () async {
    final broken = DashboardCache(
      directory: () async => throw const FileSystemException('denied'),
    );
    await broken.save(_userId, _date, tz, _bundleJson(70));
    expect(await broken.takeOnce(_userId, _date, tz), isNull);
  });
}
