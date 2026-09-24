import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/services/billing/entitlement_state.dart';
import 'package:kallo_mobile/services/billing/entitlements_provider.dart';
import 'package:kallo_mobile/services/billing/feature_lock.dart';
import 'package:kallo_mobile/services/http/api_client.dart';

const _userId = '11111111-1111-1111-1111-111111111111';

/// Answers the entitlement GET with [snapshot], or hangs while [pending].
class _Api extends ApiClient {
  _Api(this.snapshot, {this.pending = false});

  final Map<String, dynamic> snapshot;
  final bool pending;

  @override
  Future<T> get<T>(String path) {
    if (pending) return Completer<T>().future;
    return Future<T>.value(snapshot as T);
  }
}

Map<String, dynamic> _snapshot({
  required bool enforcement,
  required bool aiAllowed,
}) => {
  'tier': aiAllowed ? 'premium' : 'free',
  'purchasesEnabled': true,
  'enforcementEnabled': enforcement,
  'features': {
    'ai_analysis': {
      'allowed': aiAllowed,
      'reason': aiAllowed ? 'entitled' : 'not_entitled',
    },
  },
};

Future<bool> _lockFor(_Api api, String feature) async {
  final container = ProviderContainer(
    overrides: [
      apiClientProvider.overrideWithValue(api),
      entitlementsUserIdProvider.overrideWithValue(_userId),
    ],
  );
  addTearDown(container.dispose);
  final sub = container.listen(premiumLockProvider(feature), (_, _) {});
  addTearDown(sub.close);
  if (!api.pending) await container.read(entitlementsProvider(_userId).future);
  return container.read(premiumLockProvider(feature));
}

void main() {
  test('free user with enforcement on: the marker shows', () async {
    final api = _Api(_snapshot(enforcement: true, aiAllowed: false));
    expect(await _lockFor(api, PremiumFeature.aiAnalysis), isTrue);
  });

  test('a feature the server did not report reads locked', () async {
    final api = _Api(_snapshot(enforcement: true, aiAllowed: false));
    expect(await _lockFor(api, PremiumFeature.relog), isTrue);
  });

  test('premium user: no marker', () async {
    final api = _Api(_snapshot(enforcement: true, aiAllowed: true));
    expect(await _lockFor(api, PremiumFeature.aiAnalysis), isFalse);
  });

  test('enforcement off: no marker even for a locked feature', () async {
    final api = _Api(_snapshot(enforcement: false, aiAllowed: false));
    expect(await _lockFor(api, PremiumFeature.aiAnalysis), isFalse);
  });

  test('while the snapshot loads: no marker', () async {
    final api = _Api(const {}, pending: true);
    expect(await _lockFor(api, PremiumFeature.aiAnalysis), isFalse);
  });
}
