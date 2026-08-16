import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/supabase_service.dart';

/// Builds the session stream from a gotrue auth-event stream.
///
/// Extracted from [sessionProvider] so the error-resilience contract below is
/// unit-testable without a live Supabase client.
///
/// **gotrue pushes auth failures onto `onAuthStateChange` as stream ERRORS**
/// (`GoTrueClient.notifyException`): a token-refresh network blip surfaces as
/// `AuthRetryableFetchException`, and an expired session on resume surfaces as
/// `AuthException('Session expired.')` right after gotrue signs the user out.
/// Those errors must never terminate this subscription — this stream is the
/// app's only source of signed-in state, so a dead stream leaves every screen
/// rendering "not signed in" until the process restarts, *including after a
/// successful re-sign-in*, because the new session event never arrives.
///
/// On an error we therefore stay subscribed and re-emit [currentSession], the
/// value gotrue updates synchronously, so the UI resyncs with what the client
/// actually holds instead of going dark.
///
/// Subscribing in `onListen` (rather than lazily, as `await for` did) also
/// closes a second hole: `onAuthStateChange` is a broadcast stream, so any
/// event fired before the subscription was attached was dropped outright.
Stream<Session?> buildSessionStream({
  required Stream<AuthState> events,
  required Session? Function() currentSession,
}) {
  final controller = StreamController<Session?>();
  StreamSubscription<AuthState>? subscription;

  controller
    ..onListen = () {
      // Seed with the session Supabase restored from secure storage on init, so
      // the very first frame already reflects signed-in/out without a flash.
      // This is the only guarantee the provider ever resolves: without it the
      // app would depend on gotrue's `BehaviorSubject` replaying an event, and
      // the router would hold the splash forever if it ever stopped.
      controller.add(currentSession());
      subscription = events.listen(
        (event) => controller.add(event.session),
        onError: (Object _, StackTrace __) => controller.add(currentSession()),
      );
    }
    ..onCancel = () => subscription?.cancel();

  return controller.stream;
}

/// Streams the current Supabase auth session.
///
/// Ported from the RN `SessionProvider` (`lib/session.tsx`): it seeds with the
/// already-restored session, then tracks `onAuthStateChange`. Riverpod's
/// `StreamProvider` gives us the same `{ session, loading }` shape the RN
/// consumers had — `AsyncLoading` ⇆ `loading`, `AsyncData(session)` ⇆ the
/// resolved value (which may be `null` when signed out).
final sessionProvider = StreamProvider<Session?>((ref) {
  final auth = SupabaseService.client.auth;
  return buildSessionStream(
    events: auth.onAuthStateChange,
    currentSession: () => auth.currentSession,
  );
});

/// Convenience: the resolved session or `null` while loading / signed out.
final currentSessionProvider = Provider<Session?>((ref) {
  return ref.watch(sessionProvider).valueOrNull;
});

/// Imperative auth actions for the auth surface (sign-in / sign-up / sign-out).
///
/// The RN `SessionProvider` exposed only `signOut`; the sign-in/up screens
/// called `supabase.auth.signInWithPassword` / `signUp` directly. This wraps
/// all three so the Flutter auth screens depend on one injectable seam.
/// Errors surface as Supabase's [AuthException] (UI can show `.message`).
class AuthController {
  const AuthController(this._auth);

  final GoTrueClient _auth;

  /// Sign in with email + password. Throws [AuthException] on failure.
  Future<AuthResponse> signInWithPassword({
    required String email,
    required String password,
  }) {
    return _auth.signInWithPassword(email: email, password: password);
  }

  /// Sign up with email + password. Throws [AuthException] on failure.
  Future<AuthResponse> signUpWithPassword({
    required String email,
    required String password,
  }) {
    return _auth.signUp(email: email, password: password);
  }

  /// Sign out, clearing the persisted session. Mirrors the RN `signOut` helper.
  Future<void> signOut() => _auth.signOut();

  /// The current user's linked identities (google / apple / email). Powers the
  /// "Sign-in methods" section in Settings → Account.
  Future<List<UserIdentity>> getUserIdentities() => _auth.getUserIdentities();

  /// Link an additional OAuth provider to the signed-in user. Uses the OAuth
  /// browser flow (there is no id-token link API) and returns through the
  /// `nham://auth-callback` deep link, where supabase_flutter completes the
  /// link. Requires `enable_manual_linking = true` on the project.
  Future<void> linkIdentity(
    OAuthProvider provider, {
    required String redirectTo,
  }) {
    return _auth.linkIdentity(
      provider,
      redirectTo: redirectTo,
      authScreenLaunchMode: LaunchMode.externalApplication,
    );
  }

  /// Remove a linked identity. The caller must keep at least one so the user
  /// isn't locked out.
  Future<void> unlinkIdentity(UserIdentity identity) =>
      _auth.unlinkIdentity(identity);
}

/// Singleton [AuthController] for the auth surface.
final authControllerProvider = Provider<AuthController>((ref) {
  return AuthController(SupabaseService.client.auth);
});
