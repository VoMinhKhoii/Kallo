/// The session [ApiClient] sends as its bearer token, and the one recovery it
/// gets when our API turns that token down with a 401.
library;

import 'package:supabase_flutter/supabase_flutter.dart';

import '../auth/supabase_service.dart';

const _refreshSkew = Duration(minutes: 5);

/// A session revoked on the server (the password changed on another device,
/// "sign out everywhere") leaves a well-formed access token on this device.
/// gotrue only refreshes it near expiry, up to an hour away, so until then
/// every request came back 401 and every screen sat on "This didn't load" with
/// a Try again that could never work. [recover] closes that gap with one
/// refresh, shared by every request that 401'd on the same token.
///
/// What gotrue (2.20, `GoTrueClient._callRefreshToken`) does with it:
///   - success: saves the new session and emits `tokenRefreshed`; the request
///     is sent once more with the new token.
///   - [AuthRetryableFetchException] (offline, timed out, auth server 5xx):
///     keeps the session. So do we: a transient failure is not a sign-out.
///   - any other [AuthException] (`refresh_token_not_found` after a global
///     sign-out, `session_expired`, `refresh_token_already_used`, ...): drops
///     the session and emits `signedOut`, supabase_flutter deletes the stored
///     copy, and the router leaves for sign-in. That is the local sign-out.
///     [_refresh] signs out itself only when gotrue threw and kept the session.
class ApiAuth {
  ApiAuth({GoTrueClient Function()? client})
    : _client = client ?? (() => SupabaseService.client.auth);

  /// Read per call, not captured: [ApiClient] is built before (and in tests
  /// without) a Supabase client.
  final GoTrueClient Function() _client;

  Future<bool>? _refreshing;

  /// The session to send with the next request, refreshed first when its
  /// token expires within five minutes; `null` while signed out.
  Future<Session?> session() async {
    final auth = _client();
    final session = auth.currentSession;
    if (session == null || !_expiresSoon(session)) return session;
    try {
      await auth.refreshSession();
    } catch (_) {
      // Send what is held; a 401 brings the request back through [recover].
    }
    return auth.currentSession;
  }

  /// Our API answered 401 to a request sent with [sent]. Returns whether to
  /// send it once more, with the token [session] now returns.
  Future<bool> recover(Session? sent) {
    final current = _client().currentSession;
    // Sent signed out, or signed out since: the 401 is the right answer.
    if (sent == null || current == null) return Future.value(false);
    // Another account signed in meanwhile: never resend this request as them.
    if (current.user.id != sent.user.id) return Future.value(false);
    // The token moved on after this request left (another 401's refresh, or
    // gotrue's own timer): resend with it rather than refresh again.
    if (current.accessToken != sent.accessToken) return Future.value(true);
    return _refreshing ??= _refresh().whenComplete(() => _refreshing = null);
  }

  Future<bool> _refresh() async {
    final auth = _client();
    try {
      await auth.refreshSession();
      return auth.currentSession != null;
    } on AuthRetryableFetchException {
      return false;
    } on AuthException {
      // The auth server turned the session down. gotrue has normally dropped
      // it already; one it threw on and kept (no refresh token to send) is
      // just as dead, and must not leave the app on the error screens.
      if (auth.currentSession != null) await _signOutLocally(auth);
      return false;
    } catch (_) {
      return false;
    }
  }

  /// [SignOutScope.local] drops the session before it calls `/logout` for
  /// this one session, which is already gone on the server; that call's
  /// outcome changes nothing here.
  Future<void> _signOutLocally(GoTrueClient auth) async {
    try {
      await auth.signOut(scope: SignOutScope.local);
    } catch (_) {}
  }

  bool _expiresSoon(Session session) {
    final expiresAt = session.expiresAt;
    if (expiresAt == null) return false;
    final expiry = DateTime.fromMillisecondsSinceEpoch(expiresAt * 1000);
    return DateTime.now().add(_refreshSkew).isAfter(expiry);
  }
}
