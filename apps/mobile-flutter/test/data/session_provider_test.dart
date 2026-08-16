/// Regression tests for the auth session stream.
///
/// The shipped bug: gotrue reports auth failures by pushing an ERROR onto
/// `onAuthStateChange` (`GoTrueClient.notifyException` — a token-refresh
/// network blip, or `AuthException('Session expired.')` after it signs a stale
/// session out on resume). The old `sessionProvider` consumed that stream with
/// `await for` inside an `async*` generator, so the first such error rethrew,
/// ended the generator and killed the stream for the rest of the process.
///
/// The user-visible result: the app appeared to log itself out, and signing
/// back in landed on a "Not signed in." screen — the router redirected
/// correctly (it reads `auth.currentSession` directly) but no screen ever saw
/// the new session, until the app was restarted.
library;

import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:nham_mobile/data/session_provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

Session _session(String id) => Session(
  accessToken: 'access-$id',
  tokenType: 'bearer',
  refreshToken: 'refresh-$id',
  user: User(
    id: id,
    appMetadata: const {},
    userMetadata: const {},
    aud: 'authenticated',
    createdAt: DateTime.utc(2026).toIso8601String(),
  ),
);

void main() {
  group('buildSessionStream', () {
    late StreamController<AuthState> events;
    late Session? current;
    late List<Session?> emitted;
    late StreamSubscription<Session?> sub;

    setUp(() {
      events = StreamController<AuthState>.broadcast();
      current = null;
      emitted = [];
      sub = buildSessionStream(
        events: events.stream,
        currentSession: () => current,
      ).listen(emitted.add);
    });

    tearDown(() async {
      await sub.cancel();
      await events.close();
    });

    test('seeds with the already-restored session', () async {
      // The seed is read at listen time, before any event arrives.
      await pumpEventQueue();
      expect(emitted, [null]);
    });

    test('tracks sign-in and sign-out events', () async {
      final session = _session('user-1');
      current = session;
      events.add(AuthState(AuthChangeEvent.signedIn, session));
      await pumpEventQueue();

      current = null;
      events.add(const AuthState(AuthChangeEvent.signedOut, null));
      await pumpEventQueue();

      expect(emitted.map((s) => s?.user.id), [null, 'user-1', null]);
    });

    test(
      'survives a stream error and still delivers a later sign-in',
      () async {
        // A token-refresh blip: gotrue signs the user out, then pushes the
        // exception onto the same stream.
        events.add(const AuthState(AuthChangeEvent.signedOut, null));
        await pumpEventQueue();
        events.addError(AuthRetryableFetchException(message: 'offline'));
        await pumpEventQueue();

        // The user signs back in. Before the fix this never arrived, because
        // the error had already terminated the generator.
        final session = _session('user-2');
        current = session;
        events.add(AuthState(AuthChangeEvent.signedIn, session));
        await pumpEventQueue();

        expect(emitted.last?.user.id, 'user-2');
      },
    );

    test('re-emits the authoritative session on error', () async {
      // gotrue keeps `currentSession` up to date synchronously, so an error
      // must resync from it rather than leave the UI on a stale value.
      final session = _session('user-3');
      current = session;
      events.add(AuthState(AuthChangeEvent.signedIn, session));
      await pumpEventQueue();

      current = null;
      events.addError(const AuthException('Session expired.'));
      await pumpEventQueue();

      expect(emitted.map((s) => s?.user.id), [null, 'user-3', null]);
    });

    test('does not forward the error to listeners', () async {
      final errors = <Object>[];
      final errorSub = buildSessionStream(
        events: events.stream,
        currentSession: () => current,
      ).listen((_) {}, onError: errors.add);
      addTearDown(errorSub.cancel);

      events.addError(const AuthException('Session expired.'));
      await pumpEventQueue();

      // An AsyncError would strand every consumer of `currentSessionProvider`.
      expect(errors, isEmpty);
    });

    test('unsubscribes from the auth stream when cancelled', () async {
      await pumpEventQueue();
      expect(events.hasListener, isTrue);

      await sub.cancel();
      await pumpEventQueue();
      expect(events.hasListener, isFalse);

      // Keep tearDown's second cancel harmless.
      sub = const Stream<Session?>.empty().listen((_) {});
    });
  });
}
