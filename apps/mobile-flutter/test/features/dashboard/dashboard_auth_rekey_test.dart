import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:kallo_mobile/features/dashboard/data/dashboard_providers.dart';
import 'package:kallo_mobile/models/http/api_error.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

/// The session expired while the app was away, the dashboard's fetch went out
/// on the dead token and cached a 401, gotrue signed the user out, and they
/// signed straight back in. The bundle is keyed on (userId, date), which is
/// the same before and after — so the 401 was served back to the fresh session
/// and Today opened on "This didn't load." until Retry was tapped.
const _userId = '11111111-1111-1111-1111-111111111111';
const _args = (userId: _userId, date: '2026-10-11');

Session _session(String token) => Session(
  accessToken: token,
  tokenType: 'bearer',
  user: const User(
    id: _userId,
    appMetadata: {},
    userMetadata: {},
    aud: 'authenticated',
    createdAt: '2026-07-28T00:00:00.000Z',
  ),
);

Map<String, dynamic> _bundleJson() => {
  'profile': null,
  'day': {'persistedMeals': <dynamic>[]},
  'weightSummary': {
    'range': '30d',
    'weights': <dynamic>[],
    'weightDates': <dynamic>[],
    'currentWeight': 70.0,
    'todayWeight': null,
    'weightPlaceholder': 70.0,
    'daysLogged': 0,
    'periodStartWeight': 70.0,
    'expectedEndWeight': 68.0,
    'goalDirection': 'down',
    'periodElapsedDays': 0,
    'projectedEndWeight': 69.0,
    'canProject': false,
  },
  'heatmap': {'cells': <dynamic>[], 'monthHeaders': <dynamic>[]},
};

/// Answers the first GET with the 401 an expired token gets, every later one
/// with a bundle.
class _ExpiredThenOkApi extends ApiClient {
  var calls = 0;

  @override
  Future<T> get<T>(String path) async {
    calls += 1;
    if (calls == 1) {
      throw ApiError('NOT_AUTHENTICATED', 401, false, 'Session expired');
    }
    return _bundleJson() as T;
  }
}

void main() {
  late _ExpiredThenOkApi api;
  late StateProvider<Session?> session;
  late ProviderContainer container;

  setUp(() {
    api = _ExpiredThenOkApi();
    session = StateProvider<Session?>((ref) => _session('expired'));
    container = ProviderContainer(
      overrides: [
        apiClientProvider.overrideWithValue(api),
        currentSessionProvider.overrideWith((ref) => ref.watch(session)),
      ],
    );
    addTearDown(container.dispose);
  });

  /// One visit to the dashboard: watch the bundle until it settles, then
  /// leave. Signed out, the screen renders its not-signed-in line and watches
  /// nothing, so the bundle must not be held open across the sign-out.
  Future<AsyncValue<DashboardBundle>> settle() async {
    final sub = container.listen(dashboardBundleProvider(_args), (_, __) {});
    try {
      await container.read(dashboardBundleProvider(_args).future);
    } catch (_) {}
    final value = container.read(dashboardBundleProvider(_args));
    sub.close();
    return value;
  }

  test(
    'a 401 cached by the expired session is gone after re-sign-in',
    () async {
      expect((await settle()).hasError, isTrue);

      // gotrue drops the dead session, then the user signs back in as themself.
      container.read(session.notifier).state = null;
      await container.pump();
      container.read(session.notifier).state = _session('fresh');

      final after = await settle();
      expect(after.hasValue, isTrue);
      expect(api.calls, 2);
    },
  );

  test('a token refresh for the same account does not refetch', () async {
    container.read(session.notifier).state = _session('fresh');
    api.calls = 1; // Past the 401: the first load succeeds.
    expect((await settle()).hasValue, isTrue);

    container.read(session.notifier).state = _session('refreshed');
    await settle();
    expect(api.calls, 2);
  });
}
