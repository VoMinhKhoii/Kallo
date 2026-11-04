import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/today_widget/data/today_widget_channel.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel(TodayWidgetChannel.kChannelName);
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
      return null;
    });
  });
  tearDown(() => messenger.setMockMethodCallHandler(channel, null));

  test('hands the day over as one JSON string', () async {
    await TodayWidgetChannel(isIOS: true).save({'date': '2026-11-04'});
    expect(calls.single.method, 'save');
    expect(jsonDecode(calls.single.arguments as String), {
      'date': '2026-11-04',
    });
  });

  test('an unchanged day is not written again', () async {
    final widget = TodayWidgetChannel(isIOS: true);
    await widget.save({'eaten': 470});
    await widget.save({'eaten': 470});
    await widget.save({'eaten': 560});
    expect(calls.map((c) => jsonDecode(c.arguments as String)['eaten']), [
      470,
      560,
    ]);
  });

  test('a write that failed is tried again', () async {
    final widget = TodayWidgetChannel(isIOS: true);
    fail = PlatformException(code: 'NO_APP_GROUP');
    await widget.save({'eaten': 470});
    fail = null;
    await widget.save({'eaten': 470});
    expect(calls, hasLength(2));
  });

  test('off iOS there is no widget to write to', () async {
    await TodayWidgetChannel(isIOS: false).save({'eaten': 470});
    expect(calls, isEmpty);
  });
}
