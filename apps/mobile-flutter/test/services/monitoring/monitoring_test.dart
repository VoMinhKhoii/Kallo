import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/services/monitoring/monitoring.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

void main() {
  test('scrubEvent drops request body, cookies, headers and query', () {
    final event = SentryEvent(
      request: SentryRequest(
        method: 'POST',
        url: 'https://api.kallo.fit/api/analyze-meal?token=abc#frag',
        data: {'message': 'phở bò'},
        cookies: 'sb=1',
        headers: {'Authorization': 'Bearer x'},
        queryString: 'token=abc',
      ),
    );

    final scrubbed = scrubEvent(event);

    expect(scrubbed.request?.method, 'POST');
    expect(scrubbed.request?.url, 'https://api.kallo.fit');
    expect(scrubbed.request?.data, isNull);
    expect(scrubbed.request?.cookies, isNull);
    expect(scrubbed.request?.headers, isEmpty);
    expect(scrubbed.request?.queryString, isNull);
  });

  test('scrubEvent keeps only the opaque user id', () {
    final event = SentryEvent(
      user: SentryUser(id: 'uuid-1', email: 'a@b.c', ipAddress: '1.2.3.4'),
    );

    final user = scrubEvent(event).user;

    expect(user?.id, 'uuid-1');
    expect(user?.email, isNull);
    expect(user?.ipAddress, isNull);
  });

  test('disabled without a SENTRY_DSN: the app runner still runs', () async {
    expect(monitoringEnabled, isFalse);
    var ran = false;
    await runWithMonitoring(() => ran = true);
    expect(ran, isTrue);
  });
}
