import 'package:google_sign_in/google_sign_in.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../logic/reuse_grant.dart';
import 'provider_sign_in_outcome.dart';

/// Native Google sign-in. Reuses the grant the user has already given where
/// there is one, otherwise opens the in-app Google account picker
/// (`google_sign_in` v7), then hands Supabase the returned identity token via
/// `signInWithIdToken` — the same end state Apple reaches, with no Safari
/// app-switch or `nham://auth-callback` deep-link round-trip. We only
/// authenticate (no Google API calls), so the ID token alone is passed; no
/// access token and no nonce (Google's `authenticate()` doesn't expose one).
///
/// `attemptLightweightAuthentication()` goes FIRST. This used to call
/// `authenticate()` unconditionally on every tap, which walks a returning
/// user through the consent screen — and, on a re-consent, makes Google send
/// them another "you granted access" email — for a grant they had already
/// given. See [reuseGrantOrAuthenticate] for why the null-checks are
/// two-deep.
///
/// A dismissed sheet is [ProviderSignInOutcome.canceled]; any other failure
/// (Google or Supabase) propagates for the controller to map to copy.
Future<ProviderSignInOutcome> runGoogleSignIn({
  required GoTrueClient auth,
}) async {
  final GoogleSignInAccount account;
  try {
    // Silent reuse first; the native account picker only if there is no
    // grant to reuse. Either path throws GoogleSignInException on cancel.
    account = await reuseGrantOrAuthenticate(
      lightweight: GoogleSignIn.instance.attemptLightweightAuthentication,
      authenticate:
          () => GoogleSignIn.instance.authenticate(
            scopeHint: const ['email', 'profile'],
          ),
    );
  } on GoogleSignInException catch (e) {
    if (e.code == GoogleSignInExceptionCode.canceled) {
      return ProviderSignInOutcome.canceled;
    }
    rethrow;
  }
  // `authentication` is a synchronous getter in v7; idToken is minted for
  // the `serverClientId` (Web) audience configured at init.
  final idToken = account.authentication.idToken;
  if (idToken == null) return ProviderSignInOutcome.missingToken;
  await auth.signInWithIdToken(
    provider: OAuthProvider.google,
    idToken: idToken,
  );
  return ProviderSignInOutcome.signedIn;
}
