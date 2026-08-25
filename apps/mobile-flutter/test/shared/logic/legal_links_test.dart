import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/shared/logic/legal_links.dart';

/// The bare `/privacy` and `/terms` paths redirect to these, so a wrong URL
/// still lands on the right page — just via a redirect that re-detects the
/// locale, which is what building them here exists to avoid. That makes the
/// failure silent on device, so pin it here instead.
void main() {
  test('builds the canonical localized docs URL', () {
    expect(privacyUrlFor('vi'), 'https://kallo.fit/vi/docs/legal/privacy');
    expect(privacyUrlFor('en'), 'https://kallo.fit/en/docs/legal/privacy');
    expect(termsUrlFor('vi'), 'https://kallo.fit/vi/docs/legal/terms');
    expect(termsUrlFor('en'), 'https://kallo.fit/en/docs/legal/terms');
  });

  test('an unshipped locale falls back to English, never a bare path', () {
    for (final code in ['fr', 'ja', '', 'VI']) {
      expect(privacyUrlFor(code), 'https://kallo.fit/en/docs/legal/privacy');
      expect(termsUrlFor(code), 'https://kallo.fit/en/docs/legal/terms');
    }
  });
}
