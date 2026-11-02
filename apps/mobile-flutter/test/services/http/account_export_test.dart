import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:kallo_mobile/models/http/api_error.dart';
import 'package:kallo_mobile/services/http/api_auth.dart';
import 'package:kallo_mobile/services/http/api_client.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

void main() {
  for (final retryAfter in [5, 3600]) {
    test(
      'export preserves the rate-limit code and Retry-After $retryAfter',
      () async {
        final auth = GoTrueClient(
          url: 'https://auth.example.test',
          autoRefreshToken: false,
        );
        addTearDown(auth.dispose);
        var requests = 0;
        final transport = MockClient((request) async {
          requests++;
          expect(request.method, 'GET');
          expect(request.url.path, '/api/v1/account');
          return http.Response(
            jsonEncode({
              'error': {
                'code': 'RATE_LIMITED',
                'status': 429,
                'retryable': true,
                'message': 'Please try again later.',
              },
            }),
            429,
            headers: {'retry-after': '$retryAfter'},
          );
        });
        addTearDown(transport.close);
        final api = ApiClient(
          httpClient: transport,
          auth: ApiAuth(client: () => auth),
        );

        await expectLater(
          api.exportMyData(),
          throwsA(
            isA<ApiError>()
                .having((error) => error.code, 'code', 'RATE_LIMITED')
                .having((error) => error.status, 'status', 429)
                .having(
                  (error) => error.retryAfterSeconds,
                  'retryAfterSeconds',
                  retryAfter.toDouble(),
                ),
          ),
        );
        expect(requests, 1);
      },
    );
  }
}
