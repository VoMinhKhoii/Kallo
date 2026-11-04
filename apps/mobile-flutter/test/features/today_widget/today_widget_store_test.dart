import 'dart:async';
import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/today_widget/data/today_widget_store.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  // home_widget's own channel: what the plugin is asked to do on iOS.
  const channel = MethodChannel('home_widget');
  final messenger =
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;

  late List<MethodCall> calls;
  Object? fail;
  setUp(() {
    calls = [];
    fail = null;
    messenger.setMockMethodCallHandler(channel, (call) async {
      calls.add(call);
      if (fail != null) throw fail!;
      return true;
    });
  });
  tearDown(() => messenger.setMockMethodCallHandler(channel, null));

  List<Object?> saved() => [
    for (final c in calls.where((c) => c.method == 'saveWidgetData'))
      jsonDecode((c.arguments as Map)['data'] as String),
  ];

  test('stores the day in the App Group, then reloads the widget', () async {
    await TodayWidgetStore(isIOS: true).save({'date': '2026-11-04'});
    expect(calls.map((c) => c.method), ['saveWidgetData', 'updateWidget']);
    final save = calls.first.arguments as Map;
    expect(save['id'], kTodayWidgetKey);
    expect(save['appGroupId'], kTodayWidgetAppGroup);
    expect(saved(), [
      {'date': '2026-11-04'},
    ]);
    expect((calls.last.arguments as Map)['ios'], kTodayWidgetKind);
  });

  test('an unchanged day is not written again', () async {
    final store = TodayWidgetStore(isIOS: true);
    await store.save({'eaten': 470});
    await store.save({'eaten': 470});
    await store.save({'eaten': 560});
    expect(saved(), [
      {'eaten': 470},
      {'eaten': 560},
    ]);
  });

  test('a write that failed is tried again', () async {
    final store = TodayWidgetStore(isIOS: true);
    fail = PlatformException(code: '-7');
    await store.save({'eaten': 470});
    fail = null;
    await store.save({'eaten': 470});
    expect(saved(), hasLength(2));
  });

  test('the latest request wins over a write still in flight', () async {
    // A lands; B is slow; A is asked for again while B is in flight. The
    // widget must end on A, the last thing asked for.
    final store = TodayWidgetStore(isIOS: true);
    await store.save({'eaten': 'A'});
    final gate = Completer<void>();
    messenger.setMockMethodCallHandler(channel, (call) async {
      calls.add(call);
      if (call.method == 'saveWidgetData' &&
          jsonDecode((call.arguments as Map)['data'] as String)['eaten'] ==
              'B') {
        await gate.future;
      }
      return true;
    });
    final b = store.save({'eaten': 'B'});
    final a = store.save({'eaten': 'A'});
    gate.complete();
    await Future.wait([a, b]);
    expect(saved().last, {'eaten': 'A'});
    expect(saved(), [
      {'eaten': 'A'},
      {'eaten': 'B'},
      {'eaten': 'A'},
    ]);
  });

  test('off iOS there is no widget to write to', () async {
    await TodayWidgetStore(isIOS: false).save({'eaten': 470});
    expect(calls, isEmpty);
  });
}
