import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:kallo_mobile/features/circle/data/circle_providers.dart';
import 'package:kallo_mobile/models/http/api_error.dart';
import 'package:kallo_mobile/services/auth/session_provider.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

import 'circle_feed_test_support.dart';

Session _sessionFor(String userId) => Session(
  accessToken: 'token-$userId',
  tokenType: 'bearer',
  user: User(
    id: userId,
    appMetadata: const {},
    userMetadata: const {},
    aud: 'authenticated',
    createdAt: '2026-07-28T00:00:00.000Z',
  ),
);

Map<String, dynamic> _profileJson(String userId, String handle) => {
  'profile': {'userId': userId, 'handle': handle},
};

void main() {
  test(
    'the viewer profile refetches when the signed-in account changes',
    () async {
      // The provider is deliberately not autoDispose and lives for the whole
      // session, so without a watch on the account user A's avatar/name/invite
      // slug would still be on screen after B signs in on the same device.
      final sessions = StreamController<Session?>();
      addTearDown(sessions.close);

      var calls = 0;
      var handle = 'an';
      final api = FakeApiClient((request) {
        expect(request.path, '/api/v1/groups/profile');
        calls++;
        return _profileJson('user-$handle', handle);
      });

      final container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(api),
          sessionProvider.overrideWith((ref) => sessions.stream),
        ],
      );
      addTearDown(container.dispose);
      // Keeps the non-autoDispose provider alive across the account switch.
      container.listen(myCircleProfileProvider, (_, __) {});

      sessions.add(_sessionFor('user-a'));
      await Future<void>.delayed(Duration.zero);
      expect(
        (await container.read(myCircleProfileProvider.future)).handle,
        'an',
      );
      final before = calls;

      handle = 'bao';
      sessions.add(_sessionFor('user-b'));
      await Future<void>.delayed(Duration.zero);

      expect(
        (await container.read(myCircleProfileProvider.future)).handle,
        'bao',
        reason: 'a sign-out/sign-in must not carry the previous user profile',
      );
      expect(
        calls,
        before + 1,
        reason: 'exactly one refetch for the new account',
      );
    },
  );

  group('a still-subscribed profile across auth changes', () {
    late StreamController<Session?> sessions;
    late ProviderContainer container;
    var calls = 0;

    setUp(() {
      sessions = StreamController<Session?>();
      calls = 0;
      final api = FakeApiClient((request) {
        calls++;
        return _profileJson('user-a', 'an');
      });
      container = ProviderContainer(
        overrides: [
          apiClientProvider.overrideWithValue(api),
          sessionProvider.overrideWith((ref) => sessions.stream),
        ],
      );
      // The header avatar keeps watching until the router swaps the shell out.
      container.listen(myCircleProfileProvider, (_, __) {});
    });

    tearDown(() {
      container.dispose();
      sessions.close();
    });

    test('signing out makes no profile request', () async {
      sessions.add(_sessionFor('user-a'));
      await Future<void>.delayed(Duration.zero);
      await container.read(myCircleProfileProvider.future);
      expect(calls, 1);

      sessions.add(null);
      await Future<void>.delayed(Duration.zero);
      await expectLater(
        container.read(myCircleProfileProvider.future),
        throwsA(isA<ApiError>()),
      );
      expect(calls, 1, reason: 'no request goes out without a session');
    });

    test('an hourly token refresh does not refetch', () async {
      sessions.add(_sessionFor('user-a'));
      await Future<void>.delayed(Duration.zero);
      await container.read(myCircleProfileProvider.future);
      expect(calls, 1);

      // Same account, new access token: what gotrue emits every hour.
      sessions.add(
        Session(
          accessToken: 'refreshed',
          tokenType: 'bearer',
          user: _sessionFor('user-a').user,
        ),
      );
      await Future<void>.delayed(Duration.zero);
      await container.read(myCircleProfileProvider.future);
      expect(calls, 1);
    });
  });
}
