/// Hands the day to the home-screen widget, through `home_widget`.
///
/// The package stores the JSON under [kTodayWidgetKey] in the App Group's
/// `UserDefaults` — the suite the extension reads
/// (`ios/TodayWidget/TodaySnapshot.swift`) — and asks WidgetKit to reload the
/// timeline of [kTodayWidgetKind]. The widget UI stays native SwiftUI; this is
/// only the bridge.
library;

import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:home_widget/home_widget.dart';

/// Shared with `Runner.entitlements`, `TodayWidget.entitlements` and the
/// extension's `TodaySnapshotStore.appGroup`.
const String kTodayWidgetAppGroup = 'group.com.khoivo.nham';

/// The `UserDefaults` key the snapshot lives under.
const String kTodayWidgetKey = 'today.snapshot';

/// The widget's `kind` (`TodayWidget.kind` in the extension).
const String kTodayWidgetKind = 'TodayWidget';

class TodayWidgetStore {
  TodayWidgetStore({bool? isIOS})
    : _isIOS = isIOS ?? defaultTargetPlatform == TargetPlatform.iOS;

  final bool _isIOS;

  /// The JSON that last LANDED (null once a write failed part-way), and the
  /// latest one asked for. Writes run one
  /// at a time and the latest request wins: a rebuild asking for A again
  /// while B is still in flight must end on A, not on B.
  String? _written;
  String? _wanted;
  Future<void>? _draining;

  /// Asks for [snapshot] to be the widget's day. An unchanged day is not
  /// written again — every write asks WidgetKit for a reload, and its daily
  /// budget is finite.
  Future<void> save(Map<String, Object?> snapshot) {
    if (!_isIOS) return Future.value();
    _wanted = jsonEncode(snapshot);
    final running = _draining;
    if (running != null) return running;
    if (_wanted == _written) return Future.value();
    // Only started with something to write, so it always awaits a write
    // before its `finally` clears [_draining] — never before it is assigned.
    return _draining = _drain();
  }

  Future<void> _drain() async {
    try {
      while (_wanted != null && _wanted != _written) {
        final json = _wanted!;
        if (!await _write(json)) {
          // The store may have landed before the reload threw, so what the
          // App Group holds is unknown: never skip a day as already written.
          _written = null;
          // Nothing newer waiting: stop, and the next save retries this one.
          // Something newer asked for while this failed: write that instead.
          if (_wanted == json) return;
          continue;
        }
        _written = json;
      }
    } finally {
      _draining = null;
    }
  }

  Future<bool> _write(String json) async {
    try {
      await HomeWidget.saveWidgetData<String>(
        kTodayWidgetKey,
        json,
        appGroupId: kTodayWidgetAppGroup,
      );
      await HomeWidget.updateWidget(iOSName: kTodayWidgetKind);
      return true;
    } on MissingPluginException {
      // A host without the native half (widget tests, an old build) — the
      // widget is a nicety, never a reason for the app to fail.
      return false;
    } on PlatformException catch (error) {
      debugPrint('today widget save failed: ${error.code}');
      return false;
    }
  }
}

final todayWidgetStoreProvider = Provider<TodayWidgetStore>(
  (ref) => TodayWidgetStore(),
);
