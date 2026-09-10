// The order the Google button signs in with: reuse an existing grant, and only
// walk the consent flow when there is none. Getting this wrong is not a crash
// — it is a returning user re-consenting (and getting Google's "you granted
// access" email) on every single tap.
import 'package:flutter_test/flutter_test.dart';
import 'package:kallo_mobile/features/auth/logic/reuse_grant.dart';

/// Stands in for `GoogleSignInAccount`, whose constructor is private to the
/// plugin — the helper is generic precisely so a test can supply its own.
typedef Account = String;

void main() {
  group('reuseGrantOrAuthenticate', () {
    test('a reusable grant signs in without the consent flow', () async {
      var authenticateCalls = 0;

      final account = await reuseGrantOrAuthenticate<Account>(
        lightweight: () async => 'existing',
        authenticate: () async {
          authenticateCalls += 1;
          return 'interactive';
        },
      );

      expect(account, 'existing');
      expect(authenticateCalls, 0, reason: 'no consent flow for a live grant');
    });

    test('no grant on hand falls through to the consent flow', () async {
      var authenticateCalls = 0;

      final account = await reuseGrantOrAuthenticate<Account>(
        // A resolved future carrying null: the platform answered, and the
        // answer is that nobody is signed in.
        lightweight: () async => null,
        authenticate: () async {
          authenticateCalls += 1;
          return 'interactive';
        },
      );

      expect(account, 'interactive');
      expect(authenticateCalls, 1);
    });

    test('a null FUTURE falls through too', () async {
      var authenticateCalls = 0;
      var lightweightCalls = 0;

      // The other half of `Future<Account?>?`: platforms that will never
      // answer this call (FedCM on the web) return no future at all. Awaiting
      // it would throw on null; it has to read as "no grant" instead.
      final account = await reuseGrantOrAuthenticate<Account>(
        lightweight: () {
          lightweightCalls += 1;
          return null;
        },
        authenticate: () async {
          authenticateCalls += 1;
          return 'interactive';
        },
      );

      expect(account, 'interactive');
      expect(lightweightCalls, 1);
      expect(authenticateCalls, 1);
    });
  });
}
