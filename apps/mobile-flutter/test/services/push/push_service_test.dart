import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/services/http/api_client.dart';
import 'package:kallo_mobile/services/push/push_channel.dart';
import 'package:kallo_mobile/services/push/push_service.dart';

typedef Request = ({String method, String path, Object? body});

/// Records every call instead of hitting the network. Mirrors the fake the
/// circle suites use, kept local so this suite owns its own contract.
class FakeApiClient extends ApiClient {
  FakeApiClient({this.fail = false});

  final List<Request> requests = [];
  bool fail;

  Future<T> _record<T>(String method, String path, Object? body) async {
    requests.add((method: method, path: path, body: body));
    if (fail) throw ApiError('BOOM', 500, true, 'nope');
    return null as T;
  }

  @override
  Future<T> post<T>(String path, [Object? body]) => _record('POST', path, body);

  @override
  Future<T> delete<T>(String path, [Object? body]) =>
      _record('DELETE', path, body);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const codec = StandardMethodCodec();
  final messenger =
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;

  late List<MethodCall> nativeCalls;
  late bool granted;
  Map<String, Object?>? initialTap;

  /// Native → Dart, the way `AppDelegate` invokes it.
  Future<void> fromNative(String method, Object? arguments) {
    final completer = Completer<void>();
    messenger.handlePlatformMessage(
      kPushMethodChannel.name,
      codec.encodeMethodCall(MethodCall(method, arguments)),
      (_) => completer.complete(),
    );
    return completer.future;
  }

  setUp(() {
    nativeCalls = [];
    granted = true;
    initialTap = null;
    messenger.setMockMethodCallHandler(kPushMethodChannel, (call) async {
      nativeCalls.add(call);
      return switch (call.method) {
        'registerForPush' => granted,
        'getInitialTap' => initialTap,
        _ => null,
      };
    });
  });

  tearDown(() {
    messenger.setMockMethodCallHandler(kPushMethodChannel, null);
  });

  test('registers with iOS and posts the token iOS hands back', () async {
    final api = FakeApiClient();
    final service = PushService(api);

    await service.registerForPush();
    expect(nativeCalls.map((c) => c.method), contains('registerForPush'));
    expect(api.requests, isEmpty, reason: 'no token yet');

    await fromNative('onToken', 'deadbeef');
    await pumpEventQueue();

    expect(api.requests.single.method, 'POST');
    expect(api.requests.single.path, '/api/v1/notifications/push-tokens');
    expect(api.requests.single.body, {'token': 'deadbeef', 'platform': 'ios'});
    expect(service.token, 'deadbeef');
  });

  test('re-posts whenever iOS rotates the token', () async {
    final api = FakeApiClient();
    final service = PushService(api);
    await service.registerForPush();

    await fromNative('onToken', 'aaaa');
    await fromNative('onToken', 'bbbb');
    await pumpEventQueue();

    expect(api.requests.map((r) => (r.body! as Map)['token']), [
      'aaaa',
      'bbbb',
    ]);
  });

  test('a second sign-in re-posts the cached token immediately', () async {
    final api = FakeApiClient();
    final service = PushService(api);
    await service.registerForPush();
    await fromNative('onToken', 'cafe');
    await pumpEventQueue();

    await service.registerForPush();
    await pumpEventQueue();

    expect(api.requests.length, 2);
    expect(api.requests.last.body, {'token': 'cafe', 'platform': 'ios'});
  });

  test('unregister deletes the token, and is a no-op without one', () async {
    final api = FakeApiClient();
    final service = PushService(api);

    await service.unregister();
    expect(api.requests, isEmpty);

    await service.registerForPush();
    await fromNative('onToken', 'feed');
    await pumpEventQueue();
    api.requests.clear();

    await service.unregister();
    expect(api.requests.single.method, 'DELETE');
    expect(api.requests.single.path, '/api/v1/notifications/push-tokens');
    expect(api.requests.single.body, {'token': 'feed'});
  });

  test('a failing token API never throws at the caller', () async {
    final api = FakeApiClient(fail: true);
    final service = PushService(api);

    await service.registerForPush();
    await fromNative('onToken', 'beef');
    await pumpEventQueue();
    await expectLater(service.unregister(), completes);
  });

  test('denied authorization is survivable and posts nothing', () async {
    granted = false;
    final api = FakeApiClient();
    final service = PushService(api);

    await expectLater(service.registerForPush(), completes);
    expect(api.requests, isEmpty);
  });

  test('a missing native handler cannot break sign-in', () async {
    messenger.setMockMethodCallHandler(kPushMethodChannel, null);
    final service = PushService(FakeApiClient());
    await expectLater(service.registerForPush(), completes);
    await expectLater(service.deliverInitialTap(), completes);
  });

  test('taps arriving before a handler is set are replayed', () async {
    final service = PushService(FakeApiClient());
    await service.registerForPush();
    await fromNative('onTap', {
      'data': {'type': 'share.reply'},
    });

    final seen = <Map<String, dynamic>>[];
    service.onTap = seen.add;
    expect(seen.single['data'], {'type': 'share.reply'});

    // Delivered once — a later handler swap must not re-fire it.
    final later = <Map<String, dynamic>>[];
    service.onTap = later.add;
    expect(later, isEmpty);
  });

  test('the cold-start tap is drained through getInitialTap', () async {
    initialTap = {
      'data': {'type': 'group.added', 'targetId': 'g1'},
    };
    final service = PushService(FakeApiClient());
    final seen = <Map<String, dynamic>>[];
    service.onTap = seen.add;

    await service.deliverInitialTap();

    expect(nativeCalls.map((c) => c.method), contains('getInitialTap'));
    expect(seen.single['data'], {'type': 'group.added', 'targetId': 'g1'});
  });
}
