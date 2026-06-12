import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../data/session_provider.dart';
import '../../../services/supabase_service.dart';

/// OAuth redirect target — mirrors the RN `Linking.createURL('auth-callback')`
/// on the `nham` scheme (`apps/mobile/app.json`), i.e. `nham://auth-callback`.
const String kAuthRedirect = 'nham://auth-callback';

/// Which auth action is currently in flight. Lets the UI spin only the button
/// that was tapped while still disabling the others — replacing the old single
/// `busy` bool that made one tap spin every control.
enum AuthAction { email, google, apple }

/// Immutable view-state for an auth screen, mirroring the RN screens'
/// `busy` / `error` / `notice` `useState` triplet — except `busy` is now an
/// `AuthAction?` so the email and Google buttons own independent spinners.
@immutable
class AuthFormState {
  const AuthFormState({
    this.action,
    this.error,
    this.notice,
    this.pendingEmail,
  });

  /// The in-flight action (email or Google), or `null` when idle.
  final AuthAction? action;

  /// `error` — Supabase error message (terracotta), or `null`.
  final String? error;

  /// `notice` — success notice (sage), used by sign-up's confirm-email path.
  final String? notice;

  /// The address a confirmation email was sent to. Non-null drives the
  /// "Check your email" cross-fade state (replacing the old vanishing toast).
  final String? pendingEmail;

  /// Any request in flight — disables inputs and the tab toggle.
  bool get busy => action != null;

  /// Whether the email submit is the in-flight action (drives its spinner).
  bool get emailBusy => action == AuthAction.email;

  /// Whether Google is the in-flight action (drives the Google button spinner).
  bool get googleBusy => action == AuthAction.google;

  /// Whether Apple is the in-flight action (drives the Apple button state).
  bool get appleBusy => action == AuthAction.apple;

  AuthFormState copyWith({
    AuthAction? action,
    String? error,
    String? notice,
    String? pendingEmail,
    bool clearAction = false,
    bool clearError = false,
    bool clearNotice = false,
    bool clearPendingEmail = false,
  }) {
    return AuthFormState(
      action: clearAction ? null : (action ?? this.action),
      error: clearError ? null : (error ?? this.error),
      notice: clearNotice ? null : (notice ?? this.notice),
      pendingEmail: clearPendingEmail ? null : (pendingEmail ?? this.pendingEmail),
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
    state = state.copyWith(action: AuthAction.email, clearError: true);
    try {
      await _ref
          .read(authControllerProvider)
          .signInWithPassword(email: email.trim(), password: password);
      // Success: the sessionProvider stream fires and the router redirect
      // routes into the app (RN did `router.replace('/logging')`).
      state = state.copyWith(clearAction: true);
    } on AuthException catch (e) {
      state = state.copyWith(clearAction: true, error: e.message);
    } catch (_) {
      state = state.copyWith(
        clearAction: true,
        error: tr('auth.signIn.error'),
      );
    }
  }

  /// RN `signUp`: trims email, calls `signUp`. If a session comes back the
  /// router routes in; otherwise show the "check your email" notice.
  Future<void> signUp({required String email, required String password}) async {
    state = state.copyWith(
      action: AuthAction.email,
      clearError: true,
      clearNotice: true,
    );
    try {
      final res = await _ref
          .read(authControllerProvider)
          .signUpWithPassword(email: email.trim(), password: password);
      if (res.session != null) {
        // Signed in immediately — router redirect takes over.
        state = state.copyWith(clearAction: true);
        return;
      }
      // No session: a confirmation email is on its way. Hold the address so the
      // UI can cross-fade to a real "Check your email" state (not a toast that
      // vanishes before the user reads it).
      state = state.copyWith(
        clearAction: true,
        pendingEmail: email.trim(),
      );
    } on AuthException catch (e) {
      state = state.copyWith(clearAction: true, error: e.message);
    } catch (_) {
      state = state.copyWith(
        clearAction: true,
        error: tr('auth.signUp.error'),
      );
    }
  }

  /// RN `signInWithGoogle` / `signUpWithGoogle` (identical): launch the Google
  /// OAuth flow. `supabase_flutter`'s `signInWithOAuth` opens the auth session
  /// and completes the PKCE `exchangeCodeForSession` on the deep-link return —
  /// the same end state the RN screens reached via `expo-web-browser` +
  /// `exchangeCodeForSession`. A cancelled flow returns `false` (no error).
  Future<void> signInWithGoogle() async {
    state = state.copyWith(
      action: AuthAction.google,
      clearError: true,
      clearNotice: true,
    );
    try {
      await _auth.signInWithOAuth(
        OAuthProvider.google,
        redirectTo: kAuthRedirect,
        authScreenLaunchMode: LaunchMode.externalApplication,
      );
      // The browser hands off; supabase_flutter's deep-link observer completes
      // the PKCE exchange on the nham://auth-callback return, onAuthStateChange
      // fires, and the router redirect routes in. Keep the `google` action set
      // so the UI can hold a "Finishing sign-in…" state across the Safari
      // app-switch; the UI's lifecycle listener clears it if the user cancels
      // and resumes still signed-out.
    } on AuthException catch (e) {
      state = state.copyWith(clearAction: true, error: e.message);
    } catch (_) {
      state = state.copyWith(
        clearAction: true,
        error: tr('auth.dialog.googleError'),
      );
    }
  }

  /// Native Sign in with Apple. Required by App Store Guideline 4.8 whenever a
  /// third-party social login (Google) is offered. Uses the native credential
  /// sheet, then hands Supabase the identity token + raw nonce so it verifies
  /// the Apple-signed hashed nonce embedded in the token.
  Future<void> signInWithApple() async {
    state = state.copyWith(
      action: AuthAction.apple,
      clearError: true,
      clearNotice: true,
    );
    try {
      final rawNonce = _generateRawNonce();
      final hashedNonce = sha256.convert(utf8.encode(rawNonce)).toString();
      final credential = await SignInWithApple.getAppleIDCredential(
        scopes: const [
          AppleIDAuthorizationScopes.email,
          AppleIDAuthorizationScopes.fullName,
        ],
        nonce: hashedNonce,
      );
      final idToken = credential.identityToken;
      if (idToken == null) {
        state = state.copyWith(
          clearAction: true,
          error: tr('auth.dialog.appleError'),
        );
        return;
      }
      await _auth.signInWithIdToken(
        provider: OAuthProvider.apple,
        idToken: idToken,
        nonce: rawNonce,
      );
      // Success: onAuthStateChange fires and the router redirect routes in.
      state = state.copyWith(clearAction: true);
    } on SignInWithAppleAuthorizationException catch (e) {
      // User cancelled the sheet → no error surfaced, just clear the spinner.
      if (e.code == AuthorizationErrorCode.canceled) {
        state = state.copyWith(clearAction: true);
        return;
      }
      state = state.copyWith(
        clearAction: true,
        error: tr('auth.dialog.appleError'),
      );
    } on AuthException catch (e) {
      state = state.copyWith(clearAction: true, error: e.message);
    } catch (_) {
      state = state.copyWith(
        clearAction: true,
        error: tr('auth.dialog.appleError'),
      );
    }
  }

  /// A cryptographically-random nonce. Its SHA-256 is sent to Apple; the raw
  /// value is sent to Supabase, which checks the two match to prevent replay.
  String _generateRawNonce([int length = 32]) {
    const charset =
        '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._';
    final random = Random.secure();
    return List.generate(
      length,
      (_) => charset[random.nextInt(charset.length)],
    ).join();
  }

  /// Re-send the sign-up confirmation email to the pending address. Drives the
  /// "Resend email" affordance on the confirm-email state; the UI owns the
  /// cooldown so a tap can't spam Supabase's own rate limit.
  Future<void> resendConfirmation() async {
    final email = state.pendingEmail;
    if (email == null) return;
    state = state.copyWith(action: AuthAction.email, clearError: true);
    try {
      await _auth.resend(type: OtpType.signup, email: email);
      state = state.copyWith(
        clearAction: true,
        notice: tr('auth.confirm.resent'),
      );
    } on AuthException catch (e) {
      state = state.copyWith(clearAction: true, error: e.message);
    } catch (e) {
      state = state.copyWith(
        clearAction: true,
        error: tr('auth.signUp.error'),
      );
    }
  }

  /// Drop the in-flight action (e.g. the OAuth browser round-trip was
  /// cancelled and the app resumed still signed-out).
  void resetAction() {
    if (state.action != null) state = state.copyWith(clearAction: true);
  }

  /// Leave the confirm-email state (the "Back" affordance).
  void clearPendingEmail() {
    state = state.copyWith(
      clearPendingEmail: true,
      clearError: true,
      clearNotice: true,
    );
  }

  /// Clear any surfaced error/notice (e.g. when the user edits a field).
  void clearMessages() {
    if (state.error != null || state.notice != null) {
      state = state.copyWith(clearError: true, clearNotice: true);
    }
  }
}

/// The auth controller. The welcome → email → confirm-email path is one flow,
/// so a single instance backs the whole surface (the old split sign-in/sign-up
/// providers collapsed with the split UI).
final signInControllerProvider =
    StateNotifierProvider.autoDispose<AuthFormController, AuthFormState>(
      AuthFormController.new,
    );
