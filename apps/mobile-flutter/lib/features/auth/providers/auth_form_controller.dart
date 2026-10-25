import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../services/auth/session_provider.dart';
import '../../../services/auth/supabase_service.dart';
import '../../../services/env/env.dart';
import '../../../services/http/api_client.dart';
import 'apple_sign_in_flow.dart';
import 'google_sign_in_flow.dart';
import 'provider_sign_in_outcome.dart';

/// Which auth action is currently in flight. Lets the UI spin only the button
/// that was tapped while still disabling the others — replacing the old single
/// `busy` bool that made one tap spin every control.
enum AuthAction { email, google, apple }

/// Substring that identifies the `before_user_created` hook's duplicate-email
/// rejection. Hard contract with the SQL hook's message — see
/// `supabase/migrations/20260629120000_block_duplicate_email_signup.sql` (and
/// the matching `DUPLICATE_EMAIL_MARKER` in the web client's callback route). A
/// test in `auth_form_controller_test.dart` asserts the migration message still
/// contains this string, so editing the SQL prose fails loudly here too.
const String kDuplicateEmailMarker = 'already exists for this email';

/// Maps a Supabase [AuthException] to warm, localized copy — the raw English
/// `e.message` never reaches the UI.
String authErrorMessage(AuthException e) {
  if (e is AuthRetryableFetchException) return tr('auth.errors.network');
  // The `before_user_created` hook rejects a duplicate-email signup with this
  // marker in its message — surface the "use your original method" copy so a
  // user signing in with a new provider on an existing email isn't dead-ended.
  if (e.message.toLowerCase().contains(kDuplicateEmailMarker)) {
    return tr('auth.errors.accountExists');
  }
  switch (e.code) {
    // Our auth proxy refused the request's Turnstile token.
    case 'captcha_failed':
      return tr('auth.errors.captcha');
    // GoTrue's one answer for a wrong code and an expired one.
    case 'otp_expired':
      return tr('auth.errors.invalidCode');
    // Supabase's per-address cooldown between two codes.
    case 'over_email_send_rate_limit':
      return tr('auth.errors.tooSoon');
    case 'over_request_rate_limit':
      return tr('auth.errors.rateLimited');
    default:
      if (e.statusCode == '429') return tr('auth.errors.rateLimited');
      return tr('auth.errors.generic');
  }
}

/// The `emailRedirectTo` every code request carries. No link is mailed, but
/// the Send Email hook writes the email in the locale of its `next`, and a
/// request WITH a `next` is how the hook knows this client can type a code
/// (iOS builds released before code sign-in sent none, and get a link).
/// Mirrors `emailCodeRedirect` in the web app's `lib/infra/auth/email-code.ts`.
String emailCodeRedirect(String locale) =>
    '${Env.apiBaseUrl}/auth/callback?next='
    '${Uri.encodeComponent('/$locale/logging')}';

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

  /// `notice` — success notice, e.g. "new code sent".
  final String? notice;

  /// The address the sign-in code went to. Non-null drives the code-entry
  /// state that replaces the email form.
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
      pendingEmail:
          clearPendingEmail ? null : (pendingEmail ?? this.pendingEmail),
    );
  }
}

/// Drives one auth screen's flows: the email code (send, verify, resend) and
/// native Google / Apple sign-in.
class AuthFormController extends StateNotifier<AuthFormState> {
  AuthFormController(this._ref) : super(const AuthFormState());

  final Ref _ref;

  GoTrueClient get _auth => SupabaseService.client.auth;

  /// Mail a sign-in code to [email] — creating the account if it is new —
  /// then move to the code-entry state. [captchaToken] is the Turnstile token
  /// (null when the check is off or could not run; the server decides).
  Future<void> sendCode({
    required String email,
    required String locale,
    String? captchaToken,
  }) async {
    final address = email.trim();
    state = state.copyWith(
      action: AuthAction.email,
      clearError: true,
      clearNotice: true,
    );
    try {
      await _ref
          .read(authControllerProvider)
          .sendEmailCode(
            email: address,
            emailRedirectTo: emailCodeRedirect(locale),
            captchaToken: captchaToken,
          );
      state = state.copyWith(clearAction: true, pendingEmail: address);
    } on AuthException catch (e) {
      state = state.copyWith(clearAction: true, error: authErrorMessage(e));
    } catch (_) {
      state = state.copyWith(
        clearAction: true,
        error: tr('auth.errors.generic'),
      );
    }
  }

  /// Sign in with the code typed for [pendingEmail]. On success the
  /// sessionProvider stream fires and the router redirect routes in.
  Future<void> verifyCode(String code) async {
    final email = state.pendingEmail;
    if (email == null || state.busy) return;
    state = state.copyWith(
      action: AuthAction.email,
      clearError: true,
      clearNotice: true,
    );
    try {
      await _ref
          .read(authControllerProvider)
          .verifyEmailCode(email: email, code: code);
      state = state.copyWith(clearAction: true);
    } on AuthException catch (e) {
      state = state.copyWith(clearAction: true, error: authErrorMessage(e));
    } catch (_) {
      state = state.copyWith(
        clearAction: true,
        error: tr('auth.errors.generic'),
      );
    }
  }

  /// Mail a fresh code to [pendingEmail]; it replaces the previous one.
  /// Returns whether it was sent, so the view restarts its cooldown only then.
  Future<bool> resendCode({
    required String locale,
    String? captchaToken,
  }) async {
    final email = state.pendingEmail;
    if (email == null) return false;
    state = state.copyWith(
      action: AuthAction.email,
      clearError: true,
      clearNotice: true,
    );
    try {
      await _ref
          .read(authControllerProvider)
          .sendEmailCode(
            email: email,
            emailRedirectTo: emailCodeRedirect(locale),
            captchaToken: captchaToken,
          );
      state = state.copyWith(clearAction: true, notice: tr('auth.code.resent'));
      return true;
    } on AuthException catch (e) {
      state = state.copyWith(clearAction: true, error: authErrorMessage(e));
    } catch (_) {
      state = state.copyWith(
        clearAction: true,
        error: tr('auth.errors.generic'),
      );
    }
    return false;
  }

  /// Native Google sign-in — the credential flow is [runGoogleSignIn].
  Future<void> signInWithGoogle() => _runProviderSignIn(
    AuthAction.google,
    'auth.dialog.googleError',
    () => runGoogleSignIn(auth: _auth),
  );

  /// Native Sign in with Apple — the credential flow is [runAppleSignIn].
  Future<void> signInWithApple() => _runProviderSignIn(
    AuthAction.apple,
    'auth.dialog.appleError',
    () => runAppleSignIn(auth: _auth, api: _ref.read(apiClientProvider)),
  );

  /// The state machine both native providers share: spin [action]'s button,
  /// run the flow, then clear the spinner — silently on cancel, with the
  /// provider's [errorKey] copy on a missing token or any non-Supabase
  /// failure, and with mapped Supabase copy on an [AuthException]. On success
  /// onAuthStateChange fires and the router redirect routes in.
  Future<void> _runProviderSignIn(
    AuthAction action,
    String errorKey,
    Future<ProviderSignInOutcome> Function() flow,
  ) async {
    state = state.copyWith(action: action, clearError: true, clearNotice: true);
    try {
      final outcome = await flow();
      state =
          outcome == ProviderSignInOutcome.missingToken
              ? state.copyWith(clearAction: true, error: tr(errorKey))
              : state.copyWith(clearAction: true);
    } on AuthException catch (e) {
      state = state.copyWith(clearAction: true, error: authErrorMessage(e));
    } catch (_) {
      state = state.copyWith(clearAction: true, error: tr(errorKey));
    }
  }

  /// Leave the code-entry state (the "Use a different email" affordance).
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

/// The auth controller. The welcome → email → code path is one flow,
/// so a single instance backs the whole surface (the old split sign-in/sign-up
/// providers collapsed with the split UI).
final signInControllerProvider =
    StateNotifierProvider.autoDispose<AuthFormController, AuthFormState>(
      AuthFormController.new,
    );
