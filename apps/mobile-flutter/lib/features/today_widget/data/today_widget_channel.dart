/// The Dart half of the home-screen widget's channel.
///
/// Native half: `ios/Runner/TodayWidgetChannel.swift`, which stores the JSON
/// in the App Group the widget extension reads and asks WidgetKit to redraw.
///
/// Channel contract:
///   Dart → native   `save`  (String JSON) → null
///
/// Sign-out is a `save` too — of the signed-out card, which holds no day.
library;

import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class TodayWidgetChannel {
  TodayWidgetChannel({MethodChannel? channel, bool? isIOS})
    : _channel = channel ?? const MethodChannel(kChannelName),
      _isIOS = isIOS ?? defaultTargetPlatform == TargetPlatform.iOS;

  static const String kChannelName = 'com.khoivo.nham/today_widget';

  final MethodChannel _channel;
  final bool _isIOS;

  /// The JSON last handed over, so an unchanged day is not written again.
  /// Every write asks WidgetKit for a reload, and its daily budget is finite.
  String? _last;

  Future<void> save(Map<String, Object?> snapshot) async {
    final json = jsonEncode(snapshot);
    if (json == _last) return;
    // Remembered only once it landed, so a failed write is retried next time.
    if (await _invoke('save', json)) _last = json;
  }

  Future<bool> _invoke(String method, [Object? arguments]) async {
    if (!_isIOS) return false;
    try {
      await _channel.invokeMethod<void>(method, arguments);
      return true;
    } on MissingPluginException {
      // A host without the native half (widget tests, an old build) — the
      // widget is a nicety, never a reason for the app to fail.
      return false;
    } on PlatformException catch (error) {
      debugPrint('today widget $method failed: ${error.code}');
      return false;
    }
  }
}

final todayWidgetChannelProvider = Provider<TodayWidgetChannel>(
  (ref) => TodayWidgetChannel(),
);
