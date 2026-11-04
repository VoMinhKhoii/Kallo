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

  /// The JSON last handed over, so an unchanged day is not written again.
  /// Every write asks WidgetKit for a reload, and its daily budget is finite.
  String? _last;

  Future<void> save(Map<String, Object?> snapshot) async {
    if (!_isIOS) return;
    final json = jsonEncode(snapshot);
    if (json == _last) return;
    try {
      await HomeWidget.saveWidgetData<String>(
        kTodayWidgetKey,
        json,
        appGroupId: kTodayWidgetAppGroup,
      );
      await HomeWidget.updateWidget(iOSName: kTodayWidgetKind);
      // Remembered only once it landed, so a failed write is retried next time.
      _last = json;
    } on MissingPluginException {
      // A host without the native half (widget tests, an old build) — the
      // widget is a nicety, never a reason for the app to fail.
    } on PlatformException catch (error) {
      debugPrint('today widget save failed: ${error.code}');
    }
  }
}

final todayWidgetStoreProvider = Provider<TodayWidgetStore>(
  (ref) => TodayWidgetStore(),
);
