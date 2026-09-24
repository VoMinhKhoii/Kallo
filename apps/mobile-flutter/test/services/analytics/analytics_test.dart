import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/services/analytics/analytics.dart';

void main() {
  test('without a POSTHOG_KEY every call is a channel-free no-op', () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final analytics = container.read(analyticsProvider);

    expect(analytics.enabled, isFalse);
    // Would throw MissingPluginException if any reached the platform channel.
    await Analytics.setup(signedInUserId: 'uuid-1');
    await Analytics.setup(signedInUserId: null);
    analytics
      ..screen('/dashboard')
      ..capture('meal_logged', properties: {'method': 'ai'})
      ..identify('uuid-1')
      ..reset();
  });
}
