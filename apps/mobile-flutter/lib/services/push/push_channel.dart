import 'package:flutter/services.dart';

/// The one channel to the native APNs bridge (`ios/Runner/AppDelegate.swift`).
///
/// Kept as a constant so tests can mock it through the test binding without an
/// injection seam, the way the rest of the app mocks platform channels.
const MethodChannel kPushMethodChannel = MethodChannel('com.khoivo.nham/push');

/// A notification payload as it crosses the channel: the APNs `userInfo`, whose
/// values may be nested one level under `data`.
typedef PushPayload = Map<String, dynamic>;

/// Thin typed wrapper over [kPushMethodChannel].
///
/// No third-party push SDK is involved: iOS asks for authorization, hands back
/// the raw APNs device token as lowercase hex, and forwards taps. Everything
/// above this class deals in Dart types only.
class PushChannel {
  const PushChannel([this.channel = kPushMethodChannel]);

  final MethodChannel channel;

  /// Install the native → Dart handlers. Safe to call more than once; the last
  /// caller wins, matching [MethodChannel.setMethodCallHandler].
  void listen({
    required void Function(String token) onToken,
    required void Function(String message) onTokenError,
    required void Function(PushPayload payload) onTap,
  }) {
    channel.setMethodCallHandler((call) async {
      switch (call.method) {
        case 'onToken':
          final token = call.arguments;
          if (token is String && token.isNotEmpty) onToken(token);
        case 'onTokenError':
          onTokenError(call.arguments?.toString() ?? 'unknown');
        case 'onTap':
          final payload = _asPayload(call.arguments);
          if (payload != null) onTap(payload);
      }
      return null;
    });
  }

  /// Request alert/badge/sound authorization and, on grant, register with APNs.
  /// The token itself arrives later through `onToken`.
  Future<bool> requestPermission() async {
    final granted = await channel.invokeMethod<bool>('registerForPush');
    return granted ?? false;
  }

  /// The tap that cold-started the app, if any. Drained once, natively.
  Future<PushPayload?> initialTap() async {
    final payload = await channel.invokeMethod<Object?>('getInitialTap');
    return _asPayload(payload);
  }

  static PushPayload? _asPayload(Object? raw) {
    if (raw is! Map) return null;
    return raw.map((key, value) => MapEntry(key.toString(), value));
  }
}
