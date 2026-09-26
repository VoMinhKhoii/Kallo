import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../services/http/api_client.dart';
import '../logic/apple_token_link.dart';
import 'provider_sign_in_outcome.dart';

/// Native Sign in with Apple. Required by App Store Guideline 4.8 whenever a
/// third-party social login (Google) is offered. Uses the native credential
/// sheet, then hands Supabase the identity token + raw nonce so it verifies
/// the Apple-signed hashed nonce embedded in the token. The credential's
/// authorization code then goes to the server ([postAppleCodeBestEffort]) so
/// deleting the account can revoke the Apple authorization.
///
/// A cancelled sheet is [ProviderSignInOutcome.canceled]; any other failure
/// (Apple or Supabase) propagates for the controller to map to copy.
Future<ProviderSignInOutcome> runAppleSignIn({
  required GoTrueClient auth,
  required ApiClient api,
}) async {
  final rawNonce = _generateRawNonce();
  final hashedNonce = sha256.convert(utf8.encode(rawNonce)).toString();
  final AuthorizationCredentialAppleID credential;
  try {
    credential = await SignInWithApple.getAppleIDCredential(
      scopes: const [
        AppleIDAuthorizationScopes.email,
        AppleIDAuthorizationScopes.fullName,
      ],
      nonce: hashedNonce,
    );
  } on SignInWithAppleAuthorizationException catch (e) {
    if (e.code == AuthorizationErrorCode.canceled) {
      return ProviderSignInOutcome.canceled;
    }
    rethrow;
  }
  final idToken = credential.identityToken;
  if (idToken == null) return ProviderSignInOutcome.missingToken;
  await auth.signInWithIdToken(
    provider: OAuthProvider.apple,
    idToken: idToken,
    nonce: rawNonce,
  );
  // Not awaited: lets account deletion revoke this Apple authorization, and
  // must never delay or fail the sign-in that just succeeded.
  unawaited(postAppleCodeBestEffort(api, credential.authorizationCode));
  return ProviderSignInOutcome.signedIn;
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
