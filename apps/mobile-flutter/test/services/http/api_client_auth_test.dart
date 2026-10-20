import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:kallo_mobile/models/http/api_error.dart';
import 'package:kallo_mobile/models/http/stream_analyze_input.dart';
import 'package:kallo_mobile/models/logging/streaming.dart';
import 'package:kallo_mobile/services/http/api_auth.dart';
import 'package:kallo_mobile/services/http/api_client.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// A session revoked on the server kept its access token on the device, so
/// every request 401'd and the app never signed out. These run the REAL
/// gotrue client against a fake auth server, so they also pin what gotrue
/// does with a refresh the server turns down, which the fix relies on.

/// An unsigned JWT; gotrue only reads `exp` (an hour out) to time refreshes.
String _jwt(String label) {
  String part(Map<String, Object> claims) =>
      base64Url.encode(utf8.encode(jsonEncode(claims))).replaceAll('=', '');
  final exp =
      DateTime.now().add(const Duration(hours: 1)).millisecondsSinceEpoch ~/
      1000;
  return '${part({'alg': 'HS256'})}.'
      '${part({'exp': exp, 'sub': 'user-1', 'label': label})}.sig';
}

final _oldToken = _jwt('old');
final _newToken = _jwt('new');

Map<String, dynamic> _sessionJson(
  String token, {
  String? refresh = 'r1',
  String userId = 'user-1',
}) => {
  'access_token': token,
  'token_type': 'bearer',
  'expires_in': 3600,
  'refresh_token': refresh,
  'user': {
    'id': userId,
    'app_metadata': <String, dynamic>{},
    'user_metadata': <String, dynamic>{},
    'aud': 'authenticated',
    'created_at': '2026-10-20T00:00:00Z',
  },
};

http.Response _json(Object body, int status) => http.Response(
  jsonEncode(body),
  status,
  headers: {'content-type': 'application/json'},
);

/// The Supabase auth server: `/token` answers [refreshReply].
class _AuthServer {
  _AuthServer(this.refreshReply);

  final Future<http.Response> Function() refreshReply;
  int refreshes = 0;
  int logouts = 0;

  late final client = MockClient((req) async {
    if (req.url.path.endsWith('/token')) {
      refreshes++;
      return refreshReply();
    }
    if (req.url.path.endsWith('/logout')) {
      logouts++;
      return http.Response('', 204);
    }
    return http.Response('unexpected ${req.url}', 500);
  });
}

Future<http.Response> _refreshed() async => _json(_sessionJson(_newToken), 200);

/// What the auth server answers once a global sign-out deleted the session.
Future<http.Response> _revoked() async => _json({
  'code': 'refresh_token_not_found',
  'message': 'Invalid Refresh Token: Refresh Token Not Found',
}, 400);

/// Our API: 401 to [_oldToken] (or [status] to every call when set), else 200.
class _Api {
  _Api({this.status});

  final int? status;
  final List<String?> tokens = [];

  /// Held per call index; the call's answer waits for it.
  final Map<int, Completer<void>> holds = {};

  late final client = MockClient((req) async {
    final call = tokens.length;
    tokens.add(req.headers['Authorization']?.replaceFirst('Bearer ', ''));
    await holds[call]?.future;
    final code = status ?? (tokens[call] == _newToken ? 200 : 401);
    if (code != 200) {
      return _json({
        'error': {'code': 'X', 'status': code, 'retryable': false},
      }, code);
    }
    if (req.url.path == '/api/analyze-meal') {
      return http.Response(
        'event: error\ndata: {"type":"error","code":"DONE",'
        '"message":"ok","retryable":false}\n\n',
        200,
      );
    }
    return _json({'ok': true, 'profile': <String, dynamic>{}}, 200);
  });
}

Future<GoTrueClient> _signedIn(
  _AuthServer server, {
  String? refresh = 'r1',
}) async {
  final gotrue = GoTrueClient(
    url: 'https://auth.test/auth/v1',
    httpClient: server.client,
    autoRefreshToken: false,
  );
  await gotrue.setInitialSession(
    jsonEncode(_sessionJson(_oldToken, refresh: refresh)),
  );
  return gotrue;
}

ApiClient _client(_Api api, GoTrueClient gotrue) =>
    ApiClient(httpClient: api.client, auth: ApiAuth(client: () => gotrue));

void main() {
  test('a 401 refreshes once and resends with the new token', () async {
    final server = _AuthServer(_refreshed);
    final api = _Api();
    final gotrue = await _signedIn(server);

    final body = await _client(api, gotrue).get<Map<String, dynamic>>('/x');

    expect(body['ok'], isTrue);
    expect(server.refreshes, 1);
    expect(api.tokens, [_oldToken, _newToken]);
  });

  test(
    'a revoked session signs out locally and the 401 still surfaces',
    () async {
      final server = _AuthServer(_revoked);
      final api = _Api();
      final gotrue = await _signedIn(server);
      final events = <AuthChangeEvent>[];
      final sub = gotrue.onAuthStateChange.listen((s) => events.add(s.event));

      await expectLater(
        _client(api, gotrue).get<Object?>('/x'),
        throwsA(isA<ApiError>().having((e) => e.status, 'status', 401)),
      );
      await pumpEventQueue();

      // gotrue dropped the session itself; the router reacts to `signedOut`.
      expect(gotrue.currentSession, isNull);
      expect(events, contains(AuthChangeEvent.signedOut));
      expect(server.logouts, 0, reason: 'a local sign-out needs no network');
      expect(api.tokens, [_oldToken], reason: 'nothing to resend with');
      await sub.cancel();
    },
  );

  test('a session gotrue cannot refresh, and keeps, is signed out', () async {
    final server = _AuthServer(_refreshed);
    final api = _Api();
    // No refresh token: refreshSession throws without dropping the session.
    final gotrue = await _signedIn(server, refresh: null);

    await expectLater(
      _client(api, gotrue).get<Object?>('/x'),
      throwsA(isA<ApiError>()),
    );

    expect(gotrue.currentSession, isNull);
    expect(server.refreshes, 0);
  });

  test(
    'a refresh lost to the network keeps the session',
    () async {
      // gotrue retries a network failure for ~6 s of real time, then throws
      // AuthRetryableFetchException and keeps the session. Slow, but it is the
      // real path, not a fake of it.
      final server = _AuthServer(
        () async => throw http.ClientException('Connection refused'),
      );
      final api = _Api();
      final gotrue = await _signedIn(server);
      final events = <AuthChangeEvent>[];
      final errors = <Object>[];
      final sub = gotrue.onAuthStateChange.listen(
        (s) => events.add(s.event),
        onError: errors.add,
      );

      await expectLater(
        _client(api, gotrue).get<Object?>('/x'),
        throwsA(isA<ApiError>().having((e) => e.status, 'status', 401)),
      );
      await pumpEventQueue();

      expect(gotrue.currentSession?.accessToken, _oldToken);
      expect(events, isNot(contains(AuthChangeEvent.signedOut)));
      // gotrue reports it as a stream ERROR, which `buildSessionStream` rides
      // out by re-emitting the session it still holds.
      expect(errors.single, isA<AuthRetryableFetchException>());
      await sub.cancel();
    },
    timeout: const Timeout(Duration(seconds: 30)),
  );

  test('concurrent 401s share one refresh', () async {
    final server = _AuthServer(_refreshed);
    final api = _Api();
    final client = _client(api, await _signedIn(server));

    final bodies = await Future.wait([
      for (var i = 0; i < 4; i++) client.get<Map<String, dynamic>>('/x$i'),
    ]);

    expect(bodies.every((b) => b['ok'] == true), isTrue);
    expect(server.refreshes, 1);
    expect(api.tokens.where((t) => t == _newToken), hasLength(4));
  });

  test('a 401 landing after the refresh resends without another', () async {
    final server = _AuthServer(_refreshed);
    final api = _Api()..holds[1] = Completer<void>();
    final client = _client(api, await _signedIn(server));

    // Both leave with the old token; the second's 401 is held back until the
    // first has refreshed and been resent.
    final first = client.get<Map<String, dynamic>>('/a');
    final second = client.get<Map<String, dynamic>>('/b');
    await first;
    api.holds[1]!.complete();
    await second;

    expect(server.refreshes, 1);
    expect(api.tokens, [_oldToken, _oldToken, _newToken, _newToken]);
  });

  test(
    'an account switched during the refresh never gets the resend',
    () async {
      // The session the refresh leaves behind belongs to someone else, as when
      // the user signs out and into another account while it runs.
      final server = _AuthServer(
        () async => _json(_sessionJson(_newToken, userId: 'user-2'), 200),
      );
      final api = _Api();
      final client = _client(api, await _signedIn(server));

      await expectLater(
        client.get<Object?>('/x'),
        throwsA(isA<ApiError>().having((e) => e.status, 'status', 401)),
      );

      expect(server.refreshes, 1);
      expect(api.tokens, [_oldToken], reason: 'not resent as user-2');
    },
  );

  test(
    'a resend that 401s again surfaces it, with no second refresh',
    () async {
      final server = _AuthServer(_refreshed);
      final api = _Api(status: 401);
      final client = _client(api, await _signedIn(server));

      await expectLater(client.get<Object?>('/x'), throwsA(isA<ApiError>()));

      expect(server.refreshes, 1);
      expect(api.tokens, hasLength(2));
    },
  );

  test('a 403 is not a 401: no refresh, no resend', () async {
    final server = _AuthServer(_refreshed);
    final api = _Api(status: 403);
    final client = _client(api, await _signedIn(server));

    await expectLater(
      client.get<Object?>('/x'),
      throwsA(isA<ApiError>().having((e) => e.status, 'status', 403)),
    );

    expect(server.refreshes, 0);
    expect(api.tokens, hasLength(1));
  });

  test('signed out, a 401 is the answer: nothing to refresh', () async {
    final server = _AuthServer(_refreshed);
    final api = _Api();
    final gotrue = GoTrueClient(
      url: 'https://auth.test/auth/v1',
      httpClient: server.client,
      autoRefreshToken: false,
    );

    await expectLater(
      _client(api, gotrue).get<Object?>('/x'),
      throwsA(isA<ApiError>()),
    );

    expect(server.refreshes, 0);
    expect(api.tokens, [null]);
  });

  test('the analyze-meal stream refreshes and resends too', () async {
    final server = _AuthServer(_refreshed);
    final api = _Api();
    final client = _client(api, await _signedIn(server));

    final events =
        await client
            .analyzeMeal(
              const StreamAnalyzeInput(
                message: 'pho',
                loggedDate: '2026-10-20',
                timezoneOffset: 0,
              ),
            )
            .toList();

    expect(events.single, isA<StreamErrorEvent>());
    expect((events.single as StreamErrorEvent).code, 'DONE');
    expect(api.tokens, [_oldToken, _newToken]);
  });

  test('an upload is rebuilt and resent after the refresh', () async {
    final server = _AuthServer(_refreshed);
    final api = _Api();
    final client = _client(api, await _signedIn(server));

    await client.uploadAvatar(
      bytes: Uint8List.fromList([1, 2, 3]),
      filename: 'a.jpg',
      contentType: 'image/jpeg',
    );

    expect(api.tokens, [_oldToken, _newToken]);
  });
}
