import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../http/api_client.dart';
import 'push_channel.dart';

/// Where device tokens are registered / released (Phase 5 of the notification
/// design). POST is an upsert keyed on the token — the OS hands one token to
/// whoever signs in next, so re-posting simply reassigns the owner.
const String kPushTokensPath = '/api/v1/notifications/push-tokens';

/// Owns the APNs device token for the signed-in session.
///
/// Contract:
///   • [registerForPush] on sign-in AND on app start while signed in — asks iOS
///     for authorization, then posts the token once it arrives (and re-posts an
///     already-cached one straight away, so a second sign-in in the same
///     process claims the token without waiting for the OS).
///   • iOS may rotate the token at any time; every `onToken` re-posts.
///   • [unregister] on sign-out — must run BEFORE the Supabase session is torn
///     down, since the DELETE rides the same Bearer token as every other call.
///
/// Nothing here is allowed to break auth: every network and channel call is
/// caught and logged. Push is a nice-to-have; sign-in is not.
class PushService {
  PushService(this._api, {PushChannel channel = const PushChannel()})
    : _channel = channel;

  final ApiClient _api;
  final PushChannel _channel;

  String? _token;
  bool _listening = false;

  /// Registration is only allowed between sign-in and sign-out. iOS can hand
  /// over a token at any moment, so a POST must be refused (not just delayed)
  /// once sign-out has begun.
  bool _active = false;

  /// The registration currently on the wire, if any — sign-out awaits it so a
  /// slow POST cannot land after the DELETE and resurrect the token.
  Future<void>? _inflight;

  /// The last token the server actually accepted. The DELETE matches on the
  /// stored row, so releasing [_token] — which may be a rotation that never
  /// got posted — would match nothing and strand the real registration.
  String? _registered;
  PushPayload? _bufferedTap;
  void Function(PushPayload payload)? _onTap;

  /// The last device token iOS handed over, or null before registration.
  @visibleForTesting
  String? get token => _token;

  /// Route handler for notification taps. Set by the registration listener; a
  /// tap that lands before it is set is buffered and replayed here.
  set onTap(void Function(PushPayload payload)? handler) {
    _onTap = handler;
    final buffered = _bufferedTap;
    if (handler != null && buffered != null) {
      _bufferedTap = null;
      handler(buffered);
    }
  }

  /// Ask iOS for notification authorization and register with APNs.
  Future<void> registerForPush() async {
    _active = true;
    try {
      if (!_listening) {
        _channel.listen(
          onToken: _handleToken,
          onTokenError: _handleTokenError,
          onTap: _handleTap,
        );
        _listening = true;
      }
      final cached = _token;
      if (cached != null) unawaited(_postToken(cached));
      final granted = await _channel.requestPermission();
      if (!granted) {
        debugPrint('[push] notification authorization denied');
      }
    } catch (error) {
      debugPrint('[push] registration failed: $error');
    }
  }

  /// Release the device token for the CURRENT session. Never throws.
  ///
  /// Order matters: stop accepting registrations, let the one already on the
  /// wire finish, and only then DELETE — the route is an upsert, so a POST
  /// completing after the DELETE would re-register the signed-out account.
  Future<void> unregister() async {
    _active = false;
    final pending = _inflight;
    if (pending != null) await pending;
    final token = _registered;
    if (token == null) return;
    try {
      await _api.delete<dynamic>(kPushTokensPath, {'token': token});
      // Only what this DELETE released — a re-registration mid-flight may have
      // already claimed a newer token that is still live on the server.
      if (_registered == token) _registered = null;
    } catch (error) {
      // Left in place so the next sign-out retries it; a lost DELETE otherwise
      // leaves the signed-out device receiving pushes forever.
      debugPrint('[push] token release failed: $error');
    }
  }

  /// The cold-start tap, if the app was launched by one.
  Future<void> deliverInitialTap() async {
    try {
      final payload = await _channel.initialTap();
      if (payload != null) _handleTap(payload);
    } catch (error) {
      debugPrint('[push] initial tap lookup failed: $error');
    }
  }

  void _handleToken(String token) {
    _token = token;
    unawaited(_postToken(token));
  }

  void _handleTokenError(String message) {
    debugPrint('[push] APNs registration error: $message');
  }

  void _handleTap(PushPayload payload) {
    final handler = _onTap;
    if (handler == null) {
      _bufferedTap = payload;
      return;
    }
    handler(payload);
  }

  /// Queue a registration behind the one already on the wire, so [_inflight] is
  /// always the tail of the chain and awaiting it covers every earlier POST.
  Future<void> _postToken(String token) async {
    final request = (_inflight ?? Future<void>.value()).then(
      (_) => _sendToken(token),
    );
    _inflight = request;
    try {
      await request;
    } finally {
      if (identical(_inflight, request)) _inflight = null;
    }
  }

  /// Registration is refused when it *starts*, not when it is queued — a POST
  /// stuck behind a slow one must not land for an account that signed out
  /// while it waited.
  Future<void> _sendToken(String token) async {
    if (!_active) return;
    try {
      await _api.post<dynamic>(kPushTokensPath, {
        'token': token,
        'platform': 'ios',
      });
      _registered = token;
    } catch (error) {
      debugPrint('[push] token registration failed: $error');
    }
  }
}

/// Singleton [PushService] — one token owner for the whole process.
final pushServiceProvider = Provider<PushService>((ref) {
  return PushService(ref.watch(apiClientProvider));
});
