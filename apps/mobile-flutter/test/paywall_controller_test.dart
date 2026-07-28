import 'package:flutter_test/flutter_test.dart';
import 'package:nham_mobile/data/billing/purchases_service.dart';
import 'package:nham_mobile/features/paywall/paywall_controller.dart';

void main() {
  test('provider-confirmed restore defers to server reconciliation', () {
    expect(immediateResultForRestore(RestoreOutcome.restored), isNull);
  });

  test('server lag after confirmed store result remains pending', () {
    expect(resultAfterEntitlementPoll(false), PaywallActionResult.pending);
  });

  test('receipt ownership conflict has a dedicated paywall result', () {
    expect(
      immediateResultForRestore(RestoreOutcome.accountConflict),
      PaywallActionResult.accountConflict,
    );
  });
}
