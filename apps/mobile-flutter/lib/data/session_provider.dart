import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../services/supabase_service.dart';

/// Streams the current Supabase auth session.
///
/// Ported from the RN `SessionProvider` (`lib/session.tsx`): it seeds with the
/// already-restored session, then tracks `onAuthStateChange`. Riverpod's
/// `StreamProvider` gives us the same `{ session, loading }` shape the RN
/// consumers had — `AsyncLoading` ⇆ `loading`, `AsyncData(session)` ⇆ the
/// resolved value (which may be `null` when signed out).
final sessionProvider = StreamProvider<Session?>((ref) async* {
  final auth = SupabaseService.client.auth;

  // Seed with the session Supabase restored from secure storage on init, so
  // the very first frame already reflects signed-in/out without a flash.
  yield auth.currentSession;

  await for (final event in auth.onAuthStateChange) {
    yield event.session;
  }
});

/// Convenience: the resolved session or `null` while loading / signed out.
final currentSessionProvider = Provider<Session?>((ref) {
  return ref.watch(sessionProvider).valueOrNull;
});

/// Whether the signed-in user has finished onboarding.
///
/// SEAM: the onboarding/data phase owns the real profile query
/// (`shouldShowOnboardingResume` in RN `lib/onboarding/logic/progress.ts`).
/// Until that lands, default to `true` so a signed-in user routes straight to
/// `/dashboard` (matching the RN index redirect, which never gated routing on
/// onboarding — the wizard is an overlay). Override this provider once the
/// profile query exists to enable the signed-in → `/onboarding` redirect.
final onboardingCompleteProvider = Provider<bool>((ref) => true);

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
}

/// Singleton [AuthController] for the auth surface.
final authControllerProvider = Provider<AuthController>((ref) {
  return AuthController(SupabaseService.client.auth);
});
