import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/auth/logic/apple_token_link.dart';
import 'package:kallo_mobile/models/http/api_error.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

typedef Request = ({String method, String path, Object? body});

/// Records POSTs instead of hitting the network; [fail] makes each one throw.
/// Overriding `post` (not the wrapper) keeps the typed wrapper's path and body
/// under test.
class FakeApiClient extends ApiClient {
  FakeApiClient({this.fail = false});

  final List<Request> requests = [];
  final bool fail;

  @override
  Future<T> post<T>(String path, [Object? body]) async {
    requests.add((method: 'POST', path: path, body: body));
    if (fail) throw ApiError('BOOM', 500, true, 'nope');
    return null as T;
  }
}

void main() {
  group('postAppleCodeBestEffort', () {
    test('posts the code to the Apple token route', () async {
      final api = FakeApiClient();
      await postAppleCodeBestEffort(api, 'code-123');
      // Records compare their Map field by identity, so check field by field.
      expect(api.requests, hasLength(1));
      final request = api.requests.single;
      expect(request.method, 'POST');
      expect(request.path, '/api/v1/auth/apple/token');
      expect(request.body, {'authorizationCode': 'code-123'});
    });

    test('swallows a server failure so sign-in is never affected', () async {
      final api = FakeApiClient(fail: true);
      await expectLater(postAppleCodeBestEffort(api, 'code-123'), completes);
      expect(api.requests, hasLength(1));
    });

    test('skips a missing or empty code without a request', () async {
      final api = FakeApiClient();
      await postAppleCodeBestEffort(api, null);
      await postAppleCodeBestEffort(api, '');
      expect(api.requests, isEmpty);
    });
  });
}
