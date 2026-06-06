import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../data/session_provider.dart';
import '../../../services/supabase_service.dart';

/// OAuth redirect target — mirrors the RN `Linking.createURL('auth-callback')`
/// on the `nham` scheme (`apps/mobile/app.json`), i.e. `nham://auth-callback`.
const String kAuthRedirect = 'nham://auth-callback';

/// Immutable view-state for an auth screen, mirroring the RN screens'
/// `busy` / `error` / `notice` `useState` triplet.
@immutable
class AuthFormState {
  const AuthFormState({this.busy = false, this.error, this.notice});

  /// `busy` — disables inputs and shows the spinner.
  final bool busy;

  /// `error` — Supabase error message (terracotta), or `null`.
  final String? error;

  /// `notice` — success notice (sage), used by sign-up's confirm-email path.
  final String? notice;

  AuthFormState copyWith({
    bool? busy,
    String? error,
    String? notice,
    bool clearError = false,
    bool clearNotice = false,
  }) {
    return AuthFormState(
      busy: busy ?? this.busy,
      error: clearError ? null : (error ?? this.error),
      notice: clearNotice ? null : (notice ?? this.notice),
    );
  }
}

/// Drives one auth screen's submit flows (email + Google), porting the RN
/// `signInWithEmail` / `signUp` / `signInWithGoogle` handlers verbatim.
class AuthFormController extends StateNotifier<AuthFormState> {
  AuthFormController(this._ref) : super(const AuthFormState());

  final Ref _ref;

  GoTrueClient get _auth => SupabaseService.client.auth;

  /// RN `signInWithEmail`: trims email, calls `signInWithPassword`, surfaces
  /// the Supabase error message, else lets the router redirect to the app.
  Future<void> signInWithEmail({
    required String email,
    required String password,
  }) async {
    state = state.copyWith(busy: true, clearError: true);
    try {
      await _ref.read(authControllerProvider).signInWithPassword(
            email: email.trim(),
            password: password,
          );
      // Success: the sessionProvider stream fires and the router redirect
      // routes into the app (RN did `router.replace('/logging')`).
      state = state.copyWith(busy: false);
    } on AuthException catch (e) {
      state = state.copyWith(busy: false, error: e.message);
    } catch (e) {
      state = state.copyWith(busy: false, error: e.toString());
    }
  }

  /// RN `signUp`: trims email, calls `signUp`. If a session comes back the
  /// router routes in; otherwise show the "check your email" notice.
  Future<void> signUp({
    required String email,
    required String password,
  }) async {
    state = state.copyWith(busy: true, clearError: true, clearNotice: true);
    try {
      final res = await _ref.read(authControllerProvider).signUpWithPassword(
            email: email.trim(),
            password: password,
          );
      if (res.session != null) {
        // Signed in immediately — router redirect takes over.
        state = state.copyWith(busy: false);
        return;
      }
      state = state.copyWith(busy: false, notice: tr('auth.signUp.success'));
    } on AuthException catch (e) {
      state = state.copyWith(busy: false, error: e.message);
    } catch (e) {
      state = state.copyWith(busy: false, error: e.toString());
    }
  }

  /// RN `signInWithGoogle` / `signUpWithGoogle` (identical): launch the Google
  /// OAuth flow. `supabase_flutter`'s `signInWithOAuth` opens the auth session
  /// and completes the PKCE `exchangeCodeForSession` on the deep-link return —
  /// the same end state the RN screens reached via `expo-web-browser` +
  /// `exchangeCodeForSession`. A cancelled flow returns `false` (no error).
  Future<void> signInWithGoogle() async {
    state = state.copyWith(busy: true, clearError: true, clearNotice: true);
    try {
      await _auth.signInWithOAuth(
        OAuthProvider.google,
        redirectTo: kAuthRedirect,
        authScreenLaunchMode: LaunchMode.externalApplication,
      );
      // The browser hands off; the deep-link callback + onAuthStateChange
      // resolve the session, and the router redirect routes in.
      state = state.copyWith(busy: false);
    } on AuthException catch (e) {
      state = state.copyWith(busy: false, error: e.message);
    } catch (_) {
      state = state.copyWith(
        busy: false,
        error: tr('auth.dialog.googleError'),
      );
    }
  }

  /// Clear any surfaced error/notice (e.g. when the user edits a field).
  void clearMessages() {
    if (state.error != null || state.notice != null) {
      state = state.copyWith(clearError: true, clearNotice: true);
    }
  }
}

/// Sign-in screen controller.
final signInControllerProvider =
    StateNotifierProvider.autoDispose<AuthFormController, AuthFormState>(
  AuthFormController.new,
);

/// Sign-up screen controller (separate instance so its `notice` state is
/// independent of sign-in).
final signUpControllerProvider =
    StateNotifierProvider.autoDispose<AuthFormController, AuthFormState>(
  AuthFormController.new,
);
