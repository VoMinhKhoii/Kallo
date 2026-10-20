/// The session [ApiClient] sends as its bearer token, and the one recovery it
/// gets when our API turns that token down with a 401.
library;

import 'dart:async';

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
///
/// gotrue also saves a refresh's result whatever happened while it ran, so a
/// sign-out (or a sign-in as someone else) that lands mid-refresh is quietly
/// overwritten by the account the user just left. [_refresh] counts sign-ins
/// and sign-outs to catch that, and puts the app back to signed out.
class ApiAuth {
  ApiAuth({GoTrueClient Function()? client})
    : _client = client ?? (() => SupabaseService.client.auth);

  /// Read per call, not captured: [ApiClient] is built before (and in tests
  /// without) a Supabase client.
  final GoTrueClient Function() _client;

  Future<bool>? _refreshing;

  /// Sign-ins and sign-outs seen since [_watchTransitions] started.
  int _transitions = 0;
  StreamSubscription<AuthState>? _transitionWatch;
  Future<void>? _watching;

  /// Starts counting [_transitions] once, and completes when it is safe to
  /// compare counts: `onAuthStateChange` replays its last event to a new
  /// listener, so that replay is let through first (a zero timer runs after
  /// the microtask that delivers it), or it would read as a change.
  Future<void> _watchTransitions(GoTrueClient auth) =>
      _watching ??= () async {
        _transitionWatch = auth.onAuthStateChange.listen((state) {
          if (state.event == AuthChangeEvent.signedIn ||
              state.event == AuthChangeEvent.signedOut) {
            _transitions++;
          }
        }, onError: (Object _) {});
        await Future<void>.delayed(Duration.zero);
      }();

  /// The session to send with the next request, refreshed first when its
  /// token expires within five minutes; `null` while signed out.
  Future<Session?> session() async {
    final auth = _client();
    final session = auth.currentSession;
    if (session != null && _expiresSoon(session)) {
      // Send what is held if it fails; a 401 brings the request back here.
      await _refreshOnce(session.user.id);
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
    return _refreshOnce(sent.user.id);
  }

  void close() => _transitionWatch?.cancel();

  /// One refresh at a time, shared by everyone asking for the same account.
  Future<bool> _refreshOnce(String userId) =>
      _refreshing ??= _refresh(userId).whenComplete(() => _refreshing = null);

  /// Refreshes [userId]'s session. True when that account is still signed in,
  /// on a new token, and nobody signed out or in while it ran.
  Future<bool> _refresh(String userId) async {
    final auth = _client();
    await _watchTransitions(auth);
    final transitions = _transitions;
    try {
      await auth.refreshSession();
    } on AuthRetryableFetchException {
      return false;
    } on AuthException {
      // The auth server turned the session down. gotrue has normally dropped
      // it already; one it threw on and kept (no refresh token to send) is
      // just as dead, and must not leave the app on the error screens.
      if (auth.currentSession?.user.id == userId) await _signOutLocally(auth);
      return false;
    } catch (_) {
      return false;
    }
    if (_transitions == transitions) {
      return auth.currentSession?.user.id == userId;
    }
    // Signed out, or in as someone else, while this ran: what gotrue just
    // saved is the account the user left. Back to signed out, no resend.
    if (auth.currentSession?.user.id == userId) await _signOutLocally(auth);
    return false;
  }

  /// [SignOutScope.local] drops the session before it calls `/logout` for
  /// that one session; whatever that call returns changes nothing here.
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
